// src/lib/webrtc-voice.ts

interface WebRTCManagerCallbacks {
  onSignalNeeded: (peerId: string, signal: any) => void;
  // CAMBIO: Callback para cuando se recibe un stream de audio remoto
  onRemoteStreamAdded: (peerId: string, stream: MediaStream) => void;
  onConnectionStateChange: (peerId: string, state: RTCPeerConnectionState) => void;
  // Opcional: mantenemos el canal de datos para metadatos futuros (ej. quién está hablando)
  onDataChannelMessage?: (peerId: string, message: string) => void; 
}

export class WebRTCVoiceManager {
  private peerConnections: Record<string, RTCPeerConnection> = {};
  private dataChannels: Record<string, RTCDataChannel> = {};
  private localStream: MediaStream | null = null;
  private callbacks: WebRTCManagerCallbacks;
  private iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

  constructor(callbacks: WebRTCManagerCallbacks) {
    this.callbacks = callbacks;
  }
  
  public setLocalStream(stream: MediaStream) {
    this.localStream = stream;
  }

  private getPeerConnection(peerId: string): RTCPeerConnection {
    if (this.peerConnections[peerId]) {
      return this.peerConnections[peerId];
    }
    
    const pc = new RTCPeerConnection(this.iceServers);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onSignalNeeded(peerId, { type: 'candidate', candidate: event.candidate.toJSON() });
      }
    };
    
    pc.onconnectionstatechange = () => {
      this.callbacks.onConnectionStateChange(peerId, pc.connectionState);
    };

    // CAMBIO CRÍTICO: Escuchar los tracks de audio remotos
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Track de audio recibido de ${peerId}`);
      this.callbacks.onRemoteStreamAdded(peerId, event.streams[0]);
    };
    
    // Opcional: Configurar data channel si se necesita
    pc.ondatachannel = (event) => {
        const channel = event.channel;
        this.dataChannels[peerId] = channel;
        channel.onmessage = (msgEvent) => {
            this.callbacks.onDataChannelMessage?.(peerId, msgEvent.data);
        };
    };

    this.peerConnections[peerId] = pc;
    return pc;
  }

  // CAMBIO: Añadir los tracks de nuestro audio local a la conexión
  private addLocalTracks(pc: RTCPeerConnection) {
      if (this.localStream) {
        // Para clientes que hablan: añadir sus tracks de audio.
        // El transceptor se creará automáticamente con dirección 'sendrecv'.
        this.localStream.getTracks().forEach(track => {
            console.log(`[WebRTC] Añadiendo track local 'sendrecv' a la conexión`);
            pc.addTrack(track, this.localStream!);
        });
      } else {
        // Para clientes que SÓLO ESCUCHAN:
        // Debemos indicar explícitamente que queremos RECIBIR audio.
        // Añadimos un transceptor de audio con dirección 'recvonly'.
        console.log(`[WebRTC] Modo escucha: Añadiendo transceptor de audio 'recvonly'.`);
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
  }

  async createOffer(peerId: string): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    // Opcional: crear data channel
    pc.createDataChannel('metadata');
    this.addLocalTracks(pc);
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    this.callbacks.onSignalNeeded(peerId, offer);
  }

  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    this.addLocalTracks(pc);

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    this.callbacks.onSignalNeeded(peerId, answer);
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections[peerId];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections[peerId];
    if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
        console.warn(`[WebRTC] Se recibió un candidato ICE para ${peerId} antes de establecer la descripción remota. Se reintentará.`);
        // Simple cola de espera (en una app robusta se usaría una cola más formal)
        setTimeout(() => this.addIceCandidate(peerId, candidate), 1000);
    }
  }
  
  public toggleMic(enabled: boolean) {
      if (this.localStream) {
          this.localStream.getAudioTracks().forEach(track => {
              track.enabled = enabled;
          });
      }
  }

  public closeConnection(peerId: string) {
    this.peerConnections[peerId]?.close();
    delete this.peerConnections[peerId];
    delete this.dataChannels[peerId];
  }

  public closeAllConnections() {
    Object.keys(this.peerConnections).forEach(id => this.closeConnection(id));
  }
}