// webrtc-base.ts - Librería base unificada para WebRTC
import { logger } from '../../utils/logger';

// Configuración común de servidores ICE
export const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // STUN servers (confiables)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    
    // 🎯 SERVIDORES TURN ALTERNATIVOS (más confiables)
    {
      urls: 'turn:turn.relay.metered.ca:80',
      username: 'd84df75d094625a5ab2493b3',
      credential: 'G+0BR+8L+92C52N43l/8J6fB'
    },
    {
      urls: 'turn:turn.relay.metered.ca:443',
      username: 'd84df75d094625a5ab2493b3',
      credential: 'G+0BR+8L+92C52N43l/8J6fB'
    },
    {
      urls: 'turns:turn.relay.metered.ca:443',
      username: 'd84df75d094625a5ab2493b3',
      credential: 'G+0BR+8L+92C52N43l/8J6fB'
    }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

// Tipos base para callbacks
export interface BaseWebRTCCallbacks {
  onSignalNeeded: (peerId: string, signal: any) => void;
  onConnectionStateChange: (peerId: string, state: RTCPeerConnectionState) => void;
  onDataChannelMessage?: (peerId: string, message: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
}

// Interfaz para datos de cada peer
export interface PeerData {
  connection: RTCPeerConnection;
  iceQueue: RTCIceCandidate[];
  dataChannel?: RTCDataChannel;
  isPolite?: boolean; // Para perfect negotiation
  makingOffer?: boolean;
  ignoreOffer?: boolean;
}

// Clase base para manejar WebRTC
export abstract class BaseWebRTCManager {
  protected peers: Map<string, PeerData> = new Map();
  protected callbacks: BaseWebRTCCallbacks;
  protected iceServers: RTCConfiguration;

  constructor(callbacks: BaseWebRTCCallbacks, iceServers?: RTCConfiguration) {
    this.callbacks = callbacks;
    this.iceServers = iceServers || DEFAULT_ICE_SERVERS;
  }

  // Método abstracto que deben implementar las clases derivadas
  protected abstract setupPeerConnection(peerId: string, pc: RTCPeerConnection): void;

  // Crear o obtener una conexión peer
  protected getPeerConnection(peerId: string, isPolite: boolean = false): RTCPeerConnection {
    let peer = this.peers.get(peerId);
    
    if (!peer) {
      const pc = new RTCPeerConnection(this.iceServers);
      const iceQueue: RTCIceCandidate[] = [];
      
      peer = { 
        connection: pc, 
        iceQueue,
        isPolite,
        makingOffer: false,
        ignoreOffer: false
      };
      this.peers.set(peerId, peer);

      // 🎯 CONFIGURAR EVENTOS BÁSICOS
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.callbacks.onSignalNeeded(peerId, { 
            type: 'candidate', 
            candidate: event.candidate.toJSON() 
          });
        }
      };

      // 🎯 MONITOREO MEJORADO DEL ESTADO DE CONEXIÓN
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        logger.webrtcInfo(`WebRTC: DataWebRTC -> onConnectionStateChange para ${peerId}: ${state}`);
        this.callbacks.onConnectionStateChange(peerId, state);
        
        if (state === 'connected') {
          logger.webrtcInfo(`✅ Conexión WebRTC establecida con ${peerId}`);
        } else if (state === 'failed') {
          logger.webrtcWarn(`Conexión con ${peerId} perdida. Estado: ${state}. Limpiando...`);
          if (this.callbacks.onPeerDisconnected) {
            this.callbacks.onPeerDisconnected(peerId);
          }
        } else if (state === 'disconnected') {
          logger.webrtcWarn(`Conexión con ${peerId} desconectada. Esperando reconexión...`);
        }
      };

      // 🎯 MONITOREO DE ICE
      pc.oniceconnectionstatechange = () => {
        logger.webrtcDebug(`ICE state para ${peerId}: ${pc.iceConnectionState}`);
        
        if (pc.iceConnectionState === 'failed') {
          logger.webrtcWarn(`ICE failed para ${peerId}. Intentando ICE restart...`);
          this.restartIce(peerId);
        }
      };

      // 🎯 MONITOREO DE GATHERING
      pc.onicegatheringstatechange = () => {
        logger.webrtcDebug(`ICE gathering state para ${peerId}: ${pc.iceGatheringState}`);
      };

      // Data channel
      pc.ondatachannel = (event) => {
        const channel = event.channel;
        peer!.dataChannel = channel;
        this.setupDataChannel(peerId, channel);
      };

      // Llamar al método específico de la clase derivada
      this.setupPeerConnection(peerId, pc);
    }

    return peer.connection;
  }

  // Configurar data channel
  protected setupDataChannel(peerId: string, channel: RTCDataChannel) {
    channel.onopen = () => {
      logger.webrtcDebug(`Data channel con ${peerId} abierto.`);
    };
    
    channel.onclose = () => {
      logger.webrtcDebug(`Data channel con ${peerId} cerrado.`);
    };
    
    channel.onerror = (error) => {
      logger.webrtcError(`Error en data channel con ${peerId}:`, error);
    };
    
    channel.onmessage = (event) => {
      this.callbacks.onDataChannelMessage?.(peerId, event.data);
    };
  }

  // Crear oferta
  public async createOffer(peerId: string): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    const peer = this.peers.get(peerId)!;
    
    // 🎯 PREVENIR MÚLTIPLES OFERTAS SIMULTÁNEAS
    if (peer.makingOffer) {
      logger.webrtcDebug(`Ya estamos creando una oferta para ${peerId}, ignorando...`);
      return;
    }

    try {
      peer.makingOffer = true;

      // Crear data channel si no existe
      if (!peer.dataChannel) {
        const channel = pc.createDataChannel('data', {
          ordered: true,
          maxRetransmits: 10
        });
        peer.dataChannel = channel;
        this.setupDataChannel(peerId, channel);
      }

      const offer = await pc.createOffer({
        iceRestart: false
      });
      
      await pc.setLocalDescription(offer);
      
      logger.webrtcDebug(`Signaling: DataWebRTC -> onSignalNeeded para ${peerId}. Enviando señal...`, offer);
      this.callbacks.onSignalNeeded(peerId, offer);
    } catch (error) {
      logger.webrtcError(`Error creando oferta para ${peerId}:`, error);
      throw error;
    } finally {
      peer.makingOffer = false;
    }
  }

  // Manejar oferta
  public async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    const peer = this.peers.get(peerId)!;

    // 🎯 VALIDAR ESTADO ANTES DE PROCESAR
    const currentState = pc.signalingState;
    
    if (currentState === 'closed') {
      logger.webrtcWarn(`Ignorando oferta para ${peerId} - conexión cerrada`);
      return;
    }

    try {
      // 🎯 SI ESTAMOS EN have-local-offer, NECESITAMOS ROLLBACK
      if (currentState === 'have-local-offer') {
        logger.webrtcInfo(`Haciendo rollback para ${peerId} debido a colisión de ofertas`);
        await pc.setLocalDescription({ type: 'rollback' });
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await this.processIceQueue(peerId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      logger.webrtcDebug(`Signaling: DataWebRTC -> onSignalNeeded para ${peerId}. Enviando señal...`, answer);
      this.callbacks.onSignalNeeded(peerId, answer);
    } catch (error) {
      logger.webrtcError(`Error manejando oferta de ${peerId}:`, error);
      throw error;
    }
  }

  // Manejar respuesta
  public async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      logger.webrtcError(`No se encontró conexión para el par ${peerId} al recibir respuesta.`);
      return;
    }

    const currentState = peer.connection.signalingState;
    
    // 🎯 SOLO ACEPTAR ANSWER SI ESTAMOS EN have-local-offer
    if (currentState !== 'have-local-offer') {
      logger.webrtcDebug(`Ignorando answer duplicada para ${peerId} - estado: ${currentState}`);
      return;
    }

    try {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
      await this.processIceQueue(peerId);
      logger.webrtcInfo(`✅ Answer establecida correctamente para ${peerId}`);
    } catch (error) {
      logger.webrtcError(`Error estableciendo answer para ${peerId}:`, error);
      throw error;
    }
  }

  // Añadir candidato ICE
  public async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers.get(peerId);
    const rtcCandidate = new RTCIceCandidate(candidate);

    if (peer && peer.connection.remoteDescription) {
      try {
        await peer.connection.addIceCandidate(rtcCandidate);
      } catch (error) {
        logger.webrtcError(`Error añadiendo candidato ICE para ${peerId}:`, error);
      }
    } else if (peer) {
      peer.iceQueue.push(rtcCandidate);
      logger.webrtcDebug(`Candidato ICE encolado para el par ${peerId}.`);
    } else {
      logger.webrtcError(`No se encontró conexión para el par ${peerId} al añadir candidato ICE.`);
    }
  }

  // Procesar cola de candidatos ICE
  protected async processIceQueue(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    while (peer.iceQueue.length > 0) {
      const candidate = peer.iceQueue.shift()!;
      try {
        logger.webrtcDebug(`Procesando candidato ICE encolado para ${peerId}...`);
        await peer.connection.addIceCandidate(candidate);
      } catch (error) {
        logger.webrtcError(`Error al añadir candidato ICE encolado para ${peerId}:`, error);
      }
    }
  }

  // 🎯 REINICIAR ICE
  protected async restartIce(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    try {
      logger.webrtcInfo(`Reiniciando ICE para ${peerId}...`);
      const offer = await peer.connection.createOffer({ iceRestart: true });
      await peer.connection.setLocalDescription(offer);
      this.callbacks.onSignalNeeded(peerId, offer);
    } catch (error) {
      logger.webrtcError(`Error reiniciando ICE para ${peerId}:`, error);
    }
  }

  // Enviar mensaje por data channel
  public broadcastMessage(message: string): void {
    this.peers.forEach((peer, peerId) => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(message);
      }
    });
  }

  // Enviar mensaje a un peer específico
  public sendMessageToPeer(peerId: string, message: string): void {
    const peer = this.peers.get(peerId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(message);
    } else {
      logger.webrtcWarn(`No se puede enviar mensaje a ${peerId} - canal no disponible`);
    }
  }

  // Cerrar conexión específica
  public closeConnection(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
      logger.webrtcDebug(`Conexión con ${peerId} cerrada.`);
      
      if (this.callbacks.onPeerDisconnected) {
        this.callbacks.onPeerDisconnected(peerId);
      }
    }
  }

  // Cerrar todas las conexiones
  public closeAllConnections(): void {
    for (const peerId of this.peers.keys()) {
      this.closeConnection(peerId);
    }
  }

  // Obtener estado de conexión
  public getConnectionState(peerId: string): RTCPeerConnectionState | null {
    const peer = this.peers.get(peerId);
    return peer ? peer.connection.connectionState : null;
  }

  // Obtener lista de peers conectados
  public getConnectedPeers(): string[] {
    const connected: string[] = [];
    this.peers.forEach((peer, peerId) => {
      if (peer.connection.connectionState === 'connected') {
        connected.push(peerId);
      }
    });
    return connected;
  }

  // Recuperar conexión
  protected async recoverConnection(peerId: string): Promise<void> {
    logger.webrtcInfo(`Intentando recuperar conexión con ${peerId}`);
    this.closeConnection(peerId);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (this.callbacks.onSignalNeeded) {
      this.callbacks.onSignalNeeded(peerId, { type: 'restart-connection' });
    }
  }

  // Verificar y reiniciar conexiones
  public async ensureConnection(peerId: string): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    const state = peer.connection.connectionState;
    if (state === 'connected') return true;
    
    if (['failed', 'disconnected', 'closed'].includes(state)) {
      logger.webrtcInfo(`Reconectando con ${peerId}, estado actual: ${state}`);
      this.closeConnection(peerId);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.createOffer(peerId);
      return false;
    }
    
    return false;
  }

  // Obtener estado de señalización
  public getSignalingState(peerId: string): string | null {
    const peer = this.peers.get(peerId);
    return peer ? peer.connection.signalingState : null;
  }

  // Limpiar conexiones muertas
  public cleanupDeadConnections(): void {
    const deadPeers: string[] = [];
    
    this.peers.forEach((peer, peerId) => {
      const state = peer.connection.connectionState;
      if (['failed', 'closed'].includes(state)) {
        deadPeers.push(peerId);
      }
    });
    
    deadPeers.forEach(peerId => {
      logger.webrtcDebug(`Limpiando conexión muerta: ${peerId}`);
      this.closeConnection(peerId);
    });
  }
}
