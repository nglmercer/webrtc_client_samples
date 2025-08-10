// webrtc-base.ts - Librería base unificada para WebRTC

// Configuración común de servidores ICE
export const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ]
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
  protected getPeerConnection(peerId: string): RTCPeerConnection {
    let peer = this.peers.get(peerId);
    
    if (!peer) {
      const pc = new RTCPeerConnection(this.iceServers);
      const iceQueue: RTCIceCandidate[] = [];
      
      peer = { connection: pc, iceQueue };
      this.peers.set(peerId, peer);

      // Configurar eventos básicos
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.callbacks.onSignalNeeded(peerId, { 
            type: 'candidate', 
            candidate: event.candidate.toJSON() 
          });
        }
      };

      pc.onconnectionstatechange = () => {
        this.callbacks.onConnectionStateChange(peerId, pc.connectionState);
        
        // Si la conexión se desconecta o falla, notificar
        if ((pc.connectionState === 'disconnected' || pc.connectionState === 'failed') && 
            this.callbacks.onPeerDisconnected) {
          this.callbacks.onPeerDisconnected(peerId);
        }
      };

      // Configurar data channel para comunicación básica
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
    channel.onopen = () => console.log(`[WebRTC] Data channel con ${peerId} abierto.`);
    channel.onclose = () => console.log(`[WebRTC] Data channel con ${peerId} cerrado.`);
    channel.onmessage = (event) => {
      this.callbacks.onDataChannelMessage?.(peerId, event.data);
    };
  }

  // Crear oferta
  public async createOffer(peerId: string): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    
    // Crear data channel si no existe
    const peer = this.peers.get(peerId)!;
    if (!peer.dataChannel) {
      const channel = pc.createDataChannel('data');
      peer.dataChannel = channel;
      this.setupDataChannel(peerId, channel);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    this.callbacks.onSignalNeeded(peerId, offer);
  }

  // Manejar oferta
  public async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.processIceQueue(peerId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    this.callbacks.onSignalNeeded(peerId, answer);
  }

  // Manejar respuesta
  public async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.error(`[WebRTC] No se encontró conexión para el par ${peerId} al recibir respuesta.`);
      return;
    }
    await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
    await this.processIceQueue(peerId);
  }

  // Añadir candidato ICE
  public async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peer = this.peers.get(peerId);
    const rtcCandidate = new RTCIceCandidate(candidate);

    if (peer && peer.connection.remoteDescription) {
      await peer.connection.addIceCandidate(rtcCandidate);
    } else if (peer) {
      peer.iceQueue.push(rtcCandidate);
      console.log(`[WebRTC] Candidato ICE encolado para el par ${peerId}.`);
    } else {
      console.error(`[WebRTC] No se encontró conexión para el par ${peerId} al añadir candidato ICE.`);
    }
  }

  // Procesar cola de candidatos ICE
  protected async processIceQueue(peerId: string): Promise<void> {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    while (peer.iceQueue.length > 0) {
      const candidate = peer.iceQueue.shift()!;
      try {
        console.log(`[WebRTC] Procesando candidato ICE encolado para ${peerId}...`);
        await peer.connection.addIceCandidate(candidate);
      } catch (error) {
        console.error(`[WebRTC] Error al añadir candidato ICE encolado para ${peerId}:`, error);
      }
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
    }
  }

  // Cerrar conexión específica
  public closeConnection(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connection.close();
      this.peers.delete(peerId);
      console.log(`[WebRTC] Conexión con ${peerId} cerrada.`);
      
      // Notificar que el peer se desconectó
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
}