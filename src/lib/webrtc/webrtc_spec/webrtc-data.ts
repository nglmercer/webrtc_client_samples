// webrtc-data.ts - Versión mejorada con manejo robusto de colisiones
// La lógica de colisión ahora está en SignalingHandler

import { BaseWebRTCManager, type BaseWebRTCCallbacks } from '../core/webrtc-base.js';

// Callbacks específicos para datos
export interface DataWebRTCCallbacks extends BaseWebRTCCallbacks {
  onDataChannelMessage: (peerId: string, message: string) => void;
  onPrivateMessage?: (fromPeerId: string, toPeerId: string, message: string) => void;
}

// Manager específico para datos/chat
export class DataWebRTCManager extends BaseWebRTCManager {
  constructor(callbacks: DataWebRTCCallbacks) {
    super(callbacks);
  }

  // Implementación específica para conexiones de datos
  protected setupPeerConnection(peerId: string, pc: RTCPeerConnection): void {
    console.log(`[DataWebRTC] Configurando conexión de datos para ${peerId}`);
    
    // Monitorear estado de señalización
    pc.onsignalingstatechange = () => {
      console.log(`[DataWebRTC] ${peerId} - Estado de señalización: ${pc.signalingState}`);
    };
  }

  // Crear oferta - versión simplificada
  public async createOffer(peerId: string): Promise<void> {
    const state = this.getSignalingState(peerId);
    
    // Validar estado antes de crear oferta
    if (state && state !== 'stable') {
      console.log(`[DataWebRTC] No se puede crear oferta para ${peerId}, estado: ${state}`);
      return;
    }

    try {
      await super.createOffer(peerId);
      console.log(`[DataWebRTC] ✅ Oferta creada para ${peerId}`);
    } catch (error) {
      console.error(`[DataWebRTC] ❌ Error creando oferta para ${peerId}:`, error);
      throw error;
    }
  }

  // Manejar oferta - versión mejorada
  public async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const state = this.getSignalingState(peerId);
    
    if (state === 'closed') {
      console.log(`[DataWebRTC] Ignorando oferta para ${peerId} - conexión cerrada`);
      return;
    }

    // 🎯 VALIDACIÓN CRÍTICA: Solo procesar ofertas si estamos en estado correcto
    if (state === 'have-local-offer') {
      console.log(`[DataWebRTC] Colisión detectada con ${peerId} - tenemos oferta local`);
      
      const peer = this.peers.get(peerId);
      if (peer) {
        try {
          // Intentar rollback primero
          await peer.connection.setLocalDescription({ type: 'rollback' });
          console.log(`[DataWebRTC] Rollback exitoso para ${peerId}`);
        } catch (rollbackError) {
          console.error(`[DataWebRTC] Error en rollback para ${peerId}:`, rollbackError);
          // Si el rollback falla, limpiar completamente
          this.closeConnection(peerId);
          return;
        }
      }
    }

    // Si estamos en have-remote-offer, ya procesamos una oferta, ignorar
    if (state === 'have-remote-offer') {
      console.log(`[DataWebRTC] Ignorando oferta duplicada para ${peerId} - ya tenemos oferta remota`);
      return;
    }

    try {
      // 🎯 CREAR CONEXIÓN SI NO EXISTE
      const peer = this.peers.get(peerId);
      if (!peer) {
        console.log(`[DataWebRTC] Creando nueva conexión para procesar oferta de ${peerId}`);
        this.getPeerConnection(peerId, true); // true = somos el peer "educado"
      }

      await super.handleOffer(peerId, offer);
      console.log(`[DataWebRTC] ✅ Oferta procesada de ${peerId}`);
    } catch (error) {
      console.error(`[DataWebRTC] ❌ Error manejando oferta de ${peerId}:`, error);
      
      // Si el error es de estado inválido, limpiar y recrear
      if (error instanceof Error && error.message.includes('InvalidStateError')) {
        console.log(`[DataWebRTC] Error de estado detectado, limpiando conexión con ${peerId}`);
        this.closeConnection(peerId);
      }
      throw error;
    }
  }

  // Manejar respuesta - versión mejorada
  public async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const state = this.getSignalingState(peerId);
    
    // Solo aceptar respuestas si estamos esperando una
    if (state !== 'have-local-offer') {
      console.log(`[DataWebRTC] Ignorando answer de ${peerId} - estado: ${state}`);
      return;
    }

    if (state === 'closed') {
      console.log(`[DataWebRTC] Ignorando answer para ${peerId} - conexión cerrada`);
      return;
    }

    try {
      await super.handleAnswer(peerId, answer);
      console.log(`[DataWebRTC] ✅ Answer establecida correctamente para ${peerId}`);
    } catch (error) {
      console.error(`[DataWebRTC] ❌ Error manejando answer de ${peerId}:`, error);
      
      // Si hay error crítico, limpiar conexión
      if (error instanceof Error && error.message.includes('InvalidStateError')) {
        this.closeConnection(peerId);
      }
      throw error;
    }
  }

  // Método específico para enviar mensajes de chat
  public sendChatMessage(peerId: string, message: string): void {
    if (peerId === 'broadcast') {
      this.broadcastMessage(message);
    } else {
      this.sendMessageToPeer(peerId, message);
    }
  }

  // Método para enviar mensaje privado
  public sendPrivateMessage(peerId: string, message: string): void {
    this.sendMessageToPeer(peerId, JSON.stringify({
      type: 'private',
      message,
      timestamp: Date.now()
    }));
  }

  // Método para forzar renegociación limpia
  public async forceRenegotiation(peerId: string): Promise<void> {
    console.log(`[DataWebRTC] Forzando renegociación con ${peerId}`);
    
    // Cerrar y recrear
    this.closeConnection(peerId);
    
    // Esperar un poco para que se limpie todo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Crear nueva oferta
    await this.createOffer(peerId);
  }
}
