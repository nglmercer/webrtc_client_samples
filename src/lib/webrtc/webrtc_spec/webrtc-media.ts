// webrtc-media.ts - Extensión para manejo de video y audio

import { BaseWebRTCManager, type BaseWebRTCCallbacks } from '../core/webrtc-base.js';

// Callbacks específicos para media (video/audio)
export interface MediaWebRTCCallbacks extends BaseWebRTCCallbacks {
  onRemoteStreamAdded: (peerId: string, stream: MediaStream) => void;
  onDataChannelMessage?: (peerId: string, message: string) => void;
}

// Manager específico para video y audio
export class MediaWebRTCManager extends BaseWebRTCManager {
  private localStream: MediaStream | null = null;

  constructor(callbacks: MediaWebRTCCallbacks) {
    super(callbacks);
  }

  // Configurar stream local
  public async setLocalStream(stream: MediaStream): Promise<void> {
    this.localStream = stream;
    if (this.peers.size === 0) return;
    const renegotiations = Array.from(this.peers.entries()).map(async ([peerId, peer]) => {
      stream.getTracks().forEach(track => {
        peer.connection.addTrack(track, stream);
        console.log(`[MediaWebRTC] Añadiendo track local (${track.kind}) a la conexión existente con ${peerId}`);
      });
      await this.createOffer(peerId);
    });
    await Promise.all(renegotiations);
  }

  // Implementación específica para conexiones de media
  protected setupPeerConnection(peerId: string, pc: RTCPeerConnection): void {
    console.log(`[MediaWebRTC] Configurando conexión de media para ${peerId}`);

    // Configurar recepción de streams remotos
    pc.ontrack = (event) => {
      console.log(`[MediaWebRTC] Stream remoto recibido de ${peerId}`);
      (this.callbacks as MediaWebRTCCallbacks).onRemoteStreamAdded(peerId, event.streams[0]);
    };

    // Añadir tracks locales si están disponibles
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        console.log(`[MediaWebRTC] Añadiendo track local (${track.kind}) a la conexión`);
        pc.addTrack(track, this.localStream!);
      });
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

  // Controlar cámara
  public toggleCam(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
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

  // Obtener estado de la cámara
  public isCamEnabled(): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    return videoTracks.length > 0 && videoTracks[0].enabled;
  }

  // Detener stream local
  public stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  // Cambiar dispositivo de audio
  public async switchAudioDevice(deviceId: string): Promise<void> {
    if (!this.localStream) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: this.localStream.getVideoTracks().length > 0
      });

      // Reemplazar tracks en todas las conexiones
      const audioTrack = newStream.getAudioTracks()[0];
      this.peers.forEach((peer) => {
        const sender = peer.connection.getSenders().find(s => 
          s.track && s.track.kind === 'audio'
        );
        if (sender) {
          sender.replaceTrack(audioTrack);
        }
      });

      // Detener tracks antiguos y actualizar stream local
      this.localStream.getAudioTracks().forEach(track => track.stop());
      this.localStream.removeTrack(this.localStream.getAudioTracks()[0]);
      this.localStream.addTrack(audioTrack);
    } catch (error) {
      console.error('[MediaWebRTC] Error al cambiar dispositivo de audio:', error);
    }
  }

  // Cambiar dispositivo de video
  public async switchVideoDevice(deviceId: string): Promise<void> {
    if (!this.localStream) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: this.localStream.getAudioTracks().length > 0,
        video: { deviceId: { exact: deviceId } }
      });

      // Reemplazar tracks en todas las conexiones
      const videoTrack = newStream.getVideoTracks()[0];
      this.peers.forEach((peer) => {
        const sender = peer.connection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      // Detener tracks antiguos y actualizar stream local
      this.localStream.getVideoTracks().forEach(track => track.stop());
      this.localStream.removeTrack(this.localStream.getVideoTracks()[0]);
      this.localStream.addTrack(videoTrack);
    } catch (error) {
      console.error('[MediaWebRTC] Error al cambiar dispositivo de video:', error);
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

  public async addMediaTrack(track: MediaStreamTrack): Promise<void> {
    if (!this.localStream) {
      this.localStream = new MediaStream([track]);
    } else {
      this.localStream.addTrack(track);
    }
    if (this.peers.size === 0) return;
    const renegotiations = Array.from(this.peers.entries()).map(async ([peerId, peer]) => {
      peer.connection.addTrack(track, this.localStream!);
      console.log(`[MediaWebRTC] Añadido track (${track.kind}) a la conexión con ${peerId}`);
      await this.createOffer(peerId);
    });
    await Promise.all(renegotiations);
  }
}