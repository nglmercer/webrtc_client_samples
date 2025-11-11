// webrtc-screen-share.ts - Extensión dedicada para screen share

import { BaseWebRTCManager, type BaseWebRTCCallbacks } from '../core/webrtc-base.js';

// Callbacks específicos para screen share
export interface ScreenShareWebRTCCallbacks extends BaseWebRTCCallbacks {
  onRemoteStreamAdded: (peerId: string, stream: MediaStream) => void;
  onDataChannelMessage?: (peerId: string, message: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
}

// Manager específico para screen share
export class ScreenShareWebRTCManager extends BaseWebRTCManager {
  private localStream: MediaStream | null = null;

  constructor(callbacks: ScreenShareWebRTCCallbacks) {
    // Configurar ICE servers adicionales para mejor conectividad
    const iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    };
    
    super(callbacks, iceServers);
  }

  // Configurar stream local
  public async setLocalStream(stream: MediaStream): Promise<void> {
    const hadPreviousStream = this.localStream !== null;
    this.localStream = stream;
    
    // Si ya hay conexiones establecidas, renegociar
    if (this.peers.size > 0) {
      console.log(`[ScreenShareWebRTC] Stream local configurado con ${this.peers.size} conexiones existentes. Renegociando...`);
      
      const renegotiations = Array.from(this.peers.keys()).map(async (peerId) => {
        this.addTracksToConnection(peerId);
        await new Promise(resolve => setTimeout(resolve, 100)); // Delay para asegurar tracks añadidos
        await this.createOffer(peerId);
      });
      
      await Promise.all(renegotiations);
      console.log(`[ScreenShareWebRTC] Renegociación completada después de setLocalStream`);
    }
  }

  // Implementación específica para conexiones de screen share
  protected setupPeerConnection(peerId: string, pc: RTCPeerConnection): void {
    console.log(`[ScreenShareWebRTC] Configurando conexión de screen share para ${peerId}`);

    // Configurar recepción de streams remotos
    pc.ontrack = (event) => {
      console.log(`[ScreenShareWebRTC] Track de screen share recibido de ${peerId}`);
      (this.callbacks as ScreenShareWebRTCCallbacks).onRemoteStreamAdded(peerId, event.streams[0]);
    };

    // Añadir tracks locales o configurar para recepción
    this.addLocalTracks(pc);
  }

  // Añadir tracks locales a la conexión
  private addLocalTracks(pc: RTCPeerConnection): void {
    if (this.localStream) {
      // Añadir tracks de video (screen) y audio
      this.localStream.getTracks().forEach(track => {
        console.log(`[ScreenShareWebRTC] Añadiendo track local (${track.kind}) 'sendrecv' a la conexión`);
        pc.addTrack(track, this.localStream!);
      });
    } else {
      // Solo recepción
      console.log(`[ScreenShareWebRTC] Modo recepción: Añadiendo transceptores 'recvonly'.`);
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }
  }

  // Método público para añadir tracks a una conexión específica
  public addTracksToConnection(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer || !this.localStream) return;
    
    // Obtener senders existentes
    const senders = peer.connection.getSenders();
    
    // Añadir nuevos tracks o reemplazar existentes
    this.localStream.getTracks().forEach(track => {
      const existingSender = senders.find(sender => 
        sender.track && sender.track.kind === track.kind
      );
      
      if (existingSender) {
        console.log(`[ScreenShareWebRTC] Reemplazando track ${track.kind} existente con ${peerId}`);
        existingSender.replaceTrack(track)
          .then(() => console.log(`[ScreenShareWebRTC] Track ${track.kind} reemplazado exitosamente con ${peerId}`))
          .catch(err => console.error(`[ScreenShareWebRTC] Error al reemplazar track ${track.kind} con ${peerId}:`, err));
      } else {
        console.log(`[ScreenShareWebRTC] Añadiendo track ${track.kind} a conexión existente con ${peerId}`);
        peer.connection.addTrack(track, this.localStream!);
      }
    });
  }

  // Añadir track individual (útil para micrófono dinámico)
  public async addMediaTrack(track: MediaStreamTrack): Promise<void> {
    if (!this.localStream) {
      this.localStream = new MediaStream([track]);
    } else {
      this.localStream.addTrack(track);
    }
    
    if (this.peers.size === 0) return;
    
    const renegotiations = Array.from(this.peers.entries()).map(async ([peerId, peer]) => {
      const existingSender = peer.connection.getSenders().find(sender => 
        sender.track && sender.track.kind === track.kind
      );
      
      if (existingSender) {
        await existingSender.replaceTrack(track);
        console.log(`[ScreenShareWebRTC] Track ${track.kind} reemplazado en ${peerId}`);
      } else {
        peer.connection.addTrack(track, this.localStream!);
        console.log(`[ScreenShareWebRTC] Track ${track.kind} añadido a ${peerId}`);
      }
      
      await this.createOffer(peerId);
    });
    
    await Promise.all(renegotiations);
  }

  // Remover track específico
  public async removeMediaTrack(trackKind: 'audio' | 'video'): Promise<void> {
    if (!this.localStream) return;
    
    const tracks = this.localStream.getTracks().filter(t => t.kind === trackKind);
    tracks.forEach(track => {
      track.stop();
      this.localStream!.removeTrack(track);
    });
    
    // Remover de todas las conexiones
    const removals = Array.from(this.peers.entries()).map(async ([peerId, peer]) => {
      const sender = peer.connection.getSenders().find(s => 
        s.track && s.track.kind === trackKind
      );
      
      if (sender) {
        await peer.connection.removeTrack(sender);
        console.log(`[ScreenShareWebRTC] Track ${trackKind} removido de ${peerId}`);
        await this.createOffer(peerId);
      }
    });
    
    await Promise.all(removals);
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

  // Obtener estado del screen share
  public isScreenSharing(): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    return videoTracks.length > 0 && videoTracks[0].enabled && videoTracks[0].readyState === 'live';
  }

  // Detener stream local
  public stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  // Obtener stream local
  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Override del método createOffer para asegurar que se añaden los tracks
  public async createOffer(peerId: string): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    
    // Asegurar que los tracks locales se añadan antes de crear la oferta
    if (this.localStream) {
      this.addTracksToConnection(peerId);
    }
    
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
    
    // Asegurar que los tracks locales se añadan antes de procesar la oferta
    if (this.localStream) {
      this.addTracksToConnection(peerId);
    }
    
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.processIceQueue(peerId);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    this.callbacks.onSignalNeeded(peerId, answer);
  }
}
