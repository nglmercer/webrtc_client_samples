// signaling-handler.ts - Manejo robusto de señalización WebRTC

export interface SignalingHandlerConfig {
  localUserId: string;
  onShouldCreateOffer: (remoteUserId: string) => Promise<void>;
  onShouldHandleOffer: (remoteUserId: string, offer: RTCSessionDescriptionInit) => Promise<void>;
  onShouldHandleAnswer: (remoteUserId: string, answer: RTCSessionDescriptionInit) => Promise<void>;
  onShouldHandleCandidate: (remoteUserId: string, candidate: RTCIceCandidateInit) => Promise<void>;
}

/**
 * 🎯 ESTRATEGIA PARA EVITAR COLISIONES:
 * 
 * 1. Solo el peer con userId MENOR (alfabéticamente) crea la oferta inicial
 * 2. Si ambos intentan crear oferta (colisión), el peer con ID MAYOR hace rollback
 * 3. Nunca procesar mensajes de nosotros mismos
 * 4. Usar delays progresivos para evitar tormentas de ofertas
 */
export class SignalingHandler {
  private localUserId: string;
  private config: SignalingHandlerConfig;
  private pendingOffers = new Set<string>();
  private connectionAttempts = new Map<string, number>();
  private lastOfferTime = new Map<string, number>();

  constructor(config: SignalingHandlerConfig) {
    this.localUserId = config.localUserId;
    this.config = config;
  }

  /**
   * Determina quién debe iniciar la oferta
   * El peer con ID MENOR alfabéticamente inicia (cambié la lógica)
   */
  private shouldInitiateOffer(remoteUserId: string): boolean {
    // El peer con ID menor alfabéticamente inicia
    return this.localUserId.localeCompare(remoteUserId) < 0;
  }

  /**
   * Verifica si un mensaje es de nosotros mismos
   */
  private isOwnMessage(remoteUserId: string): boolean {
    return remoteUserId === this.localUserId;
  }

  /**
   * Calcula delay progresivo para evitar tormentas
   */
  private getProgressiveDelay(remoteUserId: string): number {
    const attempts = this.connectionAttempts.get(remoteUserId) || 0;
    // Delay base + incremento por intento + jitter aleatorio
    return 100 + (attempts * 200) + Math.random() * 100;
  }

  /**
   * Incrementa contador de intentos
   */
  private incrementAttempts(remoteUserId: string): void {
    const current = this.connectionAttempts.get(remoteUserId) || 0;
    this.connectionAttempts.set(remoteUserId, current + 1);
  }

  /**
   * Resetea contador de intentos
   */
  private resetAttempts(remoteUserId: string): void {
    this.connectionAttempts.delete(remoteUserId);
  }

  /**
   * Maneja la solicitud de nueva participación
   */
  public async handleNewParticipationRequest(remoteUserId: string): Promise<void> {
    // 🎯 CRÍTICO: Ignorar nuestros propios mensajes
    if (this.isOwnMessage(remoteUserId)) {
      console.log(`[Signaling] Ignorando nuestra propia solicitud de participación`);
      return;
    }

    console.log(`[Signaling] Nueva solicitud de participación de: ${remoteUserId}`);
    
    // Verificar si ya estamos procesando una oferta
    if (this.pendingOffers.has(remoteUserId)) {
      console.log(`[Signaling] Ya hay una oferta pendiente con ${remoteUserId}`);
      return;
    }

    if (this.shouldInitiateOffer(remoteUserId)) {
      console.log(`[Signaling] Nosotros (${this.localUserId}) iniciamos la oferta a ${remoteUserId}`);
      
      const delay = this.getProgressiveDelay(remoteUserId);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      this.pendingOffers.add(remoteUserId);
      this.lastOfferTime.set(remoteUserId, Date.now());
      this.incrementAttempts(remoteUserId);

      try {
        await this.config.onShouldCreateOffer(remoteUserId);
      } catch (error) {
        console.error(`[Signaling] Error creando oferta para ${remoteUserId}:`, error);
        this.pendingOffers.delete(remoteUserId);
      }
    } else {
      console.log(`[Signaling] Esperando oferta de ${remoteUserId} (ellos inician)`);
    }
  }

  /**
   * Maneja ofertas WebRTC entrantes
   */
  public async handleIncomingOffer(
    remoteUserId: string, 
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    // 🎯 CRÍTICO: Ignorar nuestras propias ofertas
    if (this.isOwnMessage(remoteUserId)) {
      console.log(`[Signaling] Ignorando nuestra propia oferta`);
      return;
    }

    console.log(`[Signaling] Oferta recibida de: ${remoteUserId}`);

    // 🎯 MANEJO DE COLISIÓN
    if (this.pendingOffers.has(remoteUserId)) {
      const lastOffer = this.lastOfferTime.get(remoteUserId) || 0;
      const timeSinceOffer = Date.now() - lastOffer;

      console.log(`[Signaling] Colisión detectada con ${remoteUserId} (${timeSinceOffer}ms desde nuestra oferta)`);

      // Si somos el peer con ID MAYOR, hacemos rollback y aceptamos la oferta entrante
      if (this.localUserId.localeCompare(remoteUserId) > 0) {
        console.log(`[Signaling] Hacemos rollback (nuestro ID es mayor)`);
        this.pendingOffers.delete(remoteUserId);
        // El rollback se manejará en DataWebRTCManager
      } else {
        // Somos el peer con ID menor, ignoramos la oferta entrante
        console.log(`[Signaling] Ignoramos oferta entrante (nuestro ID es menor)`);
        return;
      }
    }

    try {
      await this.config.onShouldHandleOffer(remoteUserId, offer);
      this.resetAttempts(remoteUserId);
    } catch (error) {
      console.error(`[Signaling] Error manejando oferta de ${remoteUserId}:`, error);
    }
  }

  /**
   * Maneja respuestas WebRTC entrantes
   */
  public async handleIncomingAnswer(
    remoteUserId: string, 
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    // 🎯 CRÍTICO: Ignorar nuestras propias respuestas
    if (this.isOwnMessage(remoteUserId)) {
      console.log(`[Signaling] Ignorando nuestra propia respuesta`);
      return;
    }

    console.log(`[Signaling] Respuesta recibida de: ${remoteUserId}`);

    // Verificar que estábamos esperando esta respuesta
    if (!this.pendingOffers.has(remoteUserId)) {
      console.warn(`[Signaling] Respuesta inesperada de ${remoteUserId} (no hay oferta pendiente)`);
      return;
    }

    this.pendingOffers.delete(remoteUserId);

    try {
      await this.config.onShouldHandleAnswer(remoteUserId, answer);
      this.resetAttempts(remoteUserId);
      console.log(`[Signaling] ✅ Conexión establecida con ${remoteUserId}`);
    } catch (error) {
      console.error(`[Signaling] Error manejando respuesta de ${remoteUserId}:`, error);
    }
  }

  /**
   * Maneja candidatos ICE entrantes
   */
  public async handleIncomingCandidate(
    remoteUserId: string, 
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    // 🎯 Ignorar nuestros propios candidatos
    if (this.isOwnMessage(remoteUserId)) {
      return;
    }

    await this.config.onShouldHandleCandidate(remoteUserId, candidate);
  }

  /**
   * Maneja la llegada de un nuevo usuario a la sala
   */
  public async handleUserConnected(remoteUserId: string): Promise<void> {
    // 🎯 CRÍTICO: No conectarnos a nosotros mismos
    if (this.isOwnMessage(remoteUserId)) {
      console.log(`[Signaling] Ignorando nuestra propia conexión`);
      return;
    }

    console.log(`[Signaling] Usuario conectado: ${remoteUserId}`);
    
    if (this.shouldInitiateOffer(remoteUserId)) {
      console.log(`[Signaling] Iniciando conexión WebRTC con ${remoteUserId}`);
      
      const delay = this.getProgressiveDelay(remoteUserId);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      this.pendingOffers.add(remoteUserId);
      this.lastOfferTime.set(remoteUserId, Date.now());
      this.incrementAttempts(remoteUserId);

      try {
        await this.config.onShouldCreateOffer(remoteUserId);
      } catch (error) {
        console.error(`[Signaling] Error iniciando conexión con ${remoteUserId}:`, error);
        this.pendingOffers.delete(remoteUserId);
      }
    } else {
      console.log(`[Signaling] Esperando que ${remoteUserId} inicie la conexión`);
    }
  }

  /**
   * Maneja la desconexión de un usuario
   */
  public handleUserDisconnected(remoteUserId: string): void {
    console.log(`[Signaling] Usuario desconectado: ${remoteUserId}`);
    this.pendingOffers.delete(remoteUserId);
    this.connectionAttempts.delete(remoteUserId);
    this.lastOfferTime.delete(remoteUserId);
  }

  /**
   * Limpia el estado para un peer específico
   */
  public cleanupPeer(remoteUserId: string): void {
    this.pendingOffers.delete(remoteUserId);
    this.connectionAttempts.delete(remoteUserId);
    this.lastOfferTime.delete(remoteUserId);
  }
}