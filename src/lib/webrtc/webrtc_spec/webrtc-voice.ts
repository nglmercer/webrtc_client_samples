// webrtc-voice.ts - Extensión para manejo de voz V2

import { BaseWebRTCManager, type BaseWebRTCCallbacks } from '../core/webrtc-base.js';

// Callbacks específicos para voz
export interface VoiceWebRTCCallbacks extends BaseWebRTCCallbacks {
  onRemoteStreamAdded: (peerId: string, stream: MediaStream) => void;
  onDataChannelMessage?: (peerId: string, message: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
}

// Manager específico para voz
export class VoiceWebRTCManager extends BaseWebRTCManager {
  private localStream: MediaStream | null = null;

  constructor(callbacks: VoiceWebRTCCallbacks) {
    super(callbacks);
  }

  // Configurar stream local
  public setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
  }

  // Implementación específica para conexiones de voz
  protected setupPeerConnection(peerId: string, pc: RTCPeerConnection): void {
    console.log(`[VoiceWebRTC] Configurando conexión de voz para ${peerId}`);

    // Configurar recepción de streams remotos
    pc.ontrack = (event) => {
      console.log(`[VoiceWebRTC] Track de audio recibido de ${peerId}`);
      (this.callbacks as VoiceWebRTCCallbacks).onRemoteStreamAdded(peerId, event.streams[0]);
    };

    // Añadir tracks locales o configurar para recepción
    this.addLocalTracks(pc);
  }

  // Añadir tracks locales a la conexión
  private addLocalTracks(pc: RTCPeerConnection): void {
    if (this.localStream) {
      // Para clientes que hablan: añadir sus tracks de audio
      this.localStream.getTracks().forEach(track => {
        console.log(`[VoiceWebRTC] Añadiendo track local 'sendrecv' a la conexión`);
        pc.addTrack(track, this.localStream!);
      });
    } else {
      // Para clientes que SÓLO ESCUCHAN: añadir transceptor de recepción
      console.log(`[VoiceWebRTC] Modo escucha: Añadiendo transceptor de audio 'recvonly'.`);
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }
  }

  // Controlar micrófono
  public toggleMic(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  // Obtener estado del micrófono
  public isMicEnabled(): boolean {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    return audioTracks.length > 0 && audioTracks[0].enabled;
  }

  // Detener stream local
  public stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  // Override del método createOffer para asegurar que se añaden los tracks
  public async createOffer(peerId: string): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    
    // Crear data channel opcional para metadatos
    const peer = this.peers.get(peerId)!;
    if (!peer.dataChannel) {
      const channel = pc.createDataChannel('metadata');
      peer.dataChannel = channel;
      this.setupDataChannel(peerId, channel);
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    this.callbacks.onSignalNeeded(peerId, offer);
  }

  // Override del método handleOffer para asegurar que se añaden los tracks
  public async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.processIceQueue(peerId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    this.callbacks.onSignalNeeded(peerId, answer);
  }
}