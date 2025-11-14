// webrtc-screen.ts - Extensión para manejo de screen sharing

import { BaseWebRTCManager, type BaseWebRTCCallbacks } from '../core/webrtc-base.js';

// Callbacks específicos para screen sharing
export interface ScreenWebRTCCallbacks extends BaseWebRTCCallbacks {
  onScreenShareStarted: (peerId: string, stream: MediaStream) => void;
  onScreenShareStopped: (peerId: string) => void;
  onDataChannelMessage?: (peerId: string, message: string) => void;
}

// Manager específico para screen sharing
export class ScreenWebRTCManager extends BaseWebRTCManager {
  private screenStream: MediaStream | null = null;
  private isSharing: boolean = false;

  constructor(callbacks: ScreenWebRTCCallbacks) {
    super(callbacks);
  }

  // Iniciar screen sharing
  public async startScreenShare(): Promise<MediaStream | null> {
    try {
      console.log('[ScreenWebRTC] Iniciando screen sharing...');
      
      // Solicitar pantalla completa con audio del sistema
      const displayMediaOptions = {
        video: {
          cursor: "always" as MediaTrackConstraints
        },
        audio: false as boolean, // Simplificado para evitar errores de tipo
        preferCurrentTab: false,
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include"
      } as any; // Type assertion para evitar errores estrictos

      // Obtener stream de pantalla
      const screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      
      this.screenStream = screenStream;
      this.isSharing = true;

      console.log('[ScreenWebRTC] Screen stream obtenido:', {
        tracks: screenStream.getTracks().length,
        videoTracks: screenStream.getVideoTracks().length,
        audioTracks: screenStream.getAudioTracks().length
      });

      // Añadir a todas las conexiones existentes
      await this.addScreenStreamToConnections();

      // Notificar que comenzó el screen sharing
      (this.callbacks as ScreenWebRTCCallbacks).onScreenShareStarted('screen', screenStream);

      // Configurar fin del screen sharing
      this.setupScreenShareEndHandler(screenStream);

      return screenStream;

    } catch (error) {
      console.error('[ScreenWebRTC] Error al iniciar screen sharing:', error);
      
      // Manejar diferentes tipos de errores
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          console.warn('[ScreenWebRTC] Permisos de pantalla denegados por el usuario');
        } else if (error.name === 'NotFoundError') {
          console.warn('[ScreenWebRTC] No se encontró fuente de pantalla');
        } else if (error.name === 'NotReadableError') {
          console.warn('[ScreenWebRTC] La fuente de pantalla no es legible');
        }
      }
      
      return null;
    }
  }

  // Detener screen sharing
  public stopScreenShare(): void {
    if (!this.screenStream || !this.isSharing) {
      console.log('[ScreenWebRTC] No hay screen sharing activo para detener');
      return;
    }

    console.log('[ScreenWebRTC] Deteniendo screen sharing...');
    
    // Detener todos los tracks del stream
    this.screenStream.getTracks().forEach(track => {
      console.log(`[ScreenWebRTC] Deteniendo track:`, track.kind, track.label);
      track.stop();
    });

    // Remover tracks de todas las conexiones
    this.removeScreenStreamFromConnections();

    this.screenStream = null;
    this.isSharing = false;

    // Notificar que se detuvo el screen sharing
    (this.callbacks as ScreenWebRTCCallbacks).onScreenShareStopped('screen');
  }

  // Alternar screen sharing
  public async toggleScreenShare(): Promise<boolean> {
    if (this.isSharing) {
      this.stopScreenShare();
      return false;
    } else {
      const stream = await this.startScreenShare();
      return stream !== null;
    }
  }

  // Verificar si está compartiendo pantalla
  public isScreenSharing(): boolean {
    return this.isSharing;
  }

  // Obtener stream actual de pantalla
  public getScreenStream(): MediaStream | null {
    return this.screenStream;
  }

  // Configuración específica para conexiones de screen sharing
  protected setupPeerConnection(peerId: string, pc: RTCPeerConnection): void {
    console.log(`[ScreenWebRTC] Configurando conexión de screen sharing para ${peerId}`);

    // Configurar recepción de streams remotos
    pc.ontrack = (event) => {
      console.log(`[ScreenWebRTC] Stream remoto recibido de ${peerId}:`, {
        tracks: event.streams.length,
        trackTypes: event.streams[0]?.getTracks().map(t => t.kind)
      });
      
      // Manejar tanto streams de pantalla como otros streams
      if (event.streams[0]) {
        const stream = event.streams[0];
        
        // Verificar si es un stream de pantalla
        const hasVideoTrack = stream.getVideoTracks().length > 0;
        if (hasVideoTrack) {
          console.log(`[ScreenWebRTC] Screen sharing stream recibido de ${peerId}`);
          (this.callbacks as ScreenWebRTCCallbacks).onScreenShareStarted?.(peerId, stream);
        } else {
          // Para otros streams, usar el callback base
          (this.callbacks as any).onRemoteStreamAdded?.(peerId, stream);
        }
      }
    };

    // Añadir tracks de pantalla si están disponibles
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => {
        console.log(`[ScreenWebRTC] Añadiendo track de pantalla (${track.kind}) a la conexión con ${peerId}`);
        pc.addTrack(track, this.screenStream!);
      });
    }

    // Crear data channel para metadatos de screen sharing
    try {
      const dataChannel = pc.createDataChannel('screen-metadata', {
        ordered: true,
        maxRetransmits: 10
      });
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.dataChannel = dataChannel;
        this.setupDataChannel(peerId, dataChannel);
      }
    } catch (error) {
      console.warn(`[ScreenWebRTC] No se pudo crear data channel para ${peerId}:`, error);
    }
  }

  // Añadir stream de pantalla a conexiones existentes
  private async addScreenStreamToConnections(): Promise<void> {
    if (!this.screenStream || this.peers.size === 0) return;

    const renegotiations = Array.from(this.peers.entries()).map(async ([peerId, peer]) => {
      console.log(`[ScreenWebRTC] Añadiendo screen stream a conexión con ${peerId}`);
      
      // Añadir tracks al peer connection
      this.screenStream!.getTracks().forEach(track => {
        peer.connection.addTrack(track, this.screenStream!);
      });

      // Crear oferta para renegociar
      await this.createOffer(peerId);
    });

    await Promise.all(renegotiations);
    console.log(`[ScreenWebRTC] Stream de pantalla añadido a ${this.peers.size} conexiones`);
  }

  // Remover stream de pantalla de conexiones
  private removeScreenStreamFromConnections(): void {
    if (!this.screenStream) return;

    const tracks = this.screenStream.getTracks();
    console.log(`[ScreenWebRTC] Removiendo ${tracks.length} tracks de screen de todas las conexiones`);

    this.peers.forEach((peer, peerId) => {
      tracks.forEach(track => {
        const sender = peer.connection.getSenders().find(s => s.track === track);
        if (sender) {
          console.log(`[ScreenWebRTC] Removiendo track de conexión con ${peerId}`);
          peer.connection.removeTrack(sender);
        }
      });
    });
  }

  // Configurar manejador para cuando el usuario detiene el screen sharing
  private setupScreenShareEndHandler(screenStream: MediaStream): void {
    const videoTrack = screenStream.getVideoTracks()[0];
    
    if (videoTrack) {
      // Escuchar cuando el track termina (usuario hace clic en "Stop sharing")
      videoTrack.addEventListener('ended', () => {
        console.log('[ScreenWebRTC] Usuario detuvo el screen sharing');
        this.stopScreenShare();
      });

      // Escuchar cuando el track se deshabilita
      videoTrack.addEventListener('mute', () => {
        console.log('[ScreenWebRTC] Screen sharing muted/deshabilitado');
        this.stopScreenShare();
      });
    }

    // Escuchar fin de todos los tracks
    screenStream.getTracks().forEach(track => {
      track.addEventListener('ended', () => {
        console.log(`[ScreenWebRTC] Track ${track.kind} terminado`);
        if (this.isSharing) {
          this.stopScreenShare();
        }
      });
    });
  }

  // Enviar metadatos de screen sharing
  public sendScreenMetadata(metadata: { action: string, data?: any }): void {
    const message = JSON.stringify({
      type: 'screen-metadata',
      timestamp: Date.now(),
      ...metadata
    });

    this.peers.forEach((peer, peerId) => {
      if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(message);
        console.log(`[ScreenWebRTC] Metadatos de screen enviados a ${peerId}:`, metadata);
      }
    });
  }

  // Override del método createOffer para screen sharing
  public async createOffer(peerId: string): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    
    const peer = this.peers.get(peerId)!;
    if (!peer.dataChannel) {
      const channel = pc.createDataChannel('screen-metadata');
      peer.dataChannel = channel;
      this.setupDataChannel(peerId, channel);
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });
      await pc.setLocalDescription(offer);
      
      console.log(`[ScreenWebRTC] Offer de screen sharing creada para ${peerId}`);
      this.callbacks.onSignalNeeded(peerId, offer);
    } catch (error) {
      console.error(`[ScreenWebRTC] Error creando offer para ${peerId}:`, error);
    }
  }

  // Obtener estadísticas del screen sharing
  public getScreenShareStats(): {
    isSharing: boolean;
    hasVideo: boolean;
    hasAudio: boolean;
    trackCount: number;
    resolution?: { width: number; height: number };
  } {
    const stats = {
      isSharing: this.isSharing,
      hasVideo: false,
      hasAudio: false,
      trackCount: 0,
      resolution: undefined as { width: number; height: number } | undefined
    };

    if (this.screenStream) {
      const videoTracks = this.screenStream.getVideoTracks();
      const audioTracks = this.screenStream.getAudioTracks();
      
      stats.hasVideo = videoTracks.length > 0;
      stats.hasAudio = audioTracks.length > 0;
      stats.trackCount = this.screenStream.getTracks().length;

      // Obtener resolución del video
      if (videoTracks.length > 0) {
        const settings = videoTracks[0].getSettings();
        if (settings.width && settings.height) {
          stats.resolution = {
            width: settings.width,
            height: settings.height
          };
        }
      }
    }

    return stats;
  }

  // Manejar señales específicas de screen sharing
  public async handleScreenSignal(peerId: string, signal: any): Promise<void> {
    try {
      if (signal.type === 'offer') {
        console.log(`[ScreenWebRTC] Offer de screen recibida de ${peerId}`);
        await this.handleOffer(peerId, signal);
      } else if (signal.type === 'answer') {
        console.log(`[ScreenWebRTC] Answer de screen recibida de ${peerId}`);
        await this.handleAnswer(peerId, signal);
      } else if (signal.candidate) {
        console.log(`[ScreenWebRTC] ICE candidate de screen recibido de ${peerId}`);
        await this.addIceCandidate(peerId, signal.candidate);
      }
    } catch (error) {
      console.error(`[ScreenWebRTC] Error manejando señal de screen de ${peerId}:`, error);
    }
  }
}
