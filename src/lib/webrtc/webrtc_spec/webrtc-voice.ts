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
  public async setLocalStream(stream: MediaStream): Promise<void> {
    const hadPreviousStream = this.localStream !== null;
    this.localStream = stream;
    
    // Si ya hay conexiones establecidas y no teníamos stream antes, renegociar
    if (this.peers.size > 0 && !hadPreviousStream) {
      console.log(`[VoiceWebRTC] Stream local configurado con ${this.peers.size} conexiones existentes. Renegociando...`);
      
      const renegotiations = Array.from(this.peers.keys()).map(async (peerId) => {
        this.addTracksToConnection(peerId);
        await new Promise(resolve => setTimeout(resolve, 50));
        await this.createOffer(peerId);
      });
      
      await Promise.all(renegotiations);
      console.log(`[VoiceWebRTC] Renegociación completada después de setLocalStream`);
    }
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

  // Método público para añadir tracks a una conexión específica (útil para renegociación)
  public addTracksToConnection(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (!peer || !this.localStream) return;
    
    // Obtener senders existentes de audio
    const senders = peer.connection.getSenders();
    const audioSenders = senders.filter(sender => 
      sender.track && sender.track.kind === 'audio'
    );
    
    // Si ya hay tracks de audio, reemplazarlos con los nuevos
    if (audioSenders.length > 0) {
      console.log(`[VoiceWebRTC] Reemplazando ${audioSenders.length} tracks de audio existentes con ${peerId}`);
      
      // Reemplazar cada track de audio existente
      const audioTracks = this.localStream.getAudioTracks();
      audioSenders.forEach((sender, index) => {
        if (audioTracks[index]) {
          sender.replaceTrack(audioTracks[index])
            .then(() => console.log(`[VoiceWebRTC] Track de audio ${index} reemplazado exitosamente con ${peerId}`))
            .catch(err => console.error(`[VoiceWebRTC] Error al reemplazar track de audio ${index} con ${peerId}:`, err));
        }
      });
      
      // Si hay más tracks nuevos que senders existentes, añadir los adicionales
      if (audioTracks.length > audioSenders.length) {
        for (let i = audioSenders.length; i < audioTracks.length; i++) {
          console.log(`[VoiceWebRTC] Añadiendo track de audio adicional ${i} a conexión con ${peerId}`);
          peer.connection.addTrack(audioTracks[i], this.localStream!);
        }
      }
    } else {
      // No hay tracks existentes, añadir todos los nuevos
      this.localStream.getTracks().forEach(track => {
        console.log(`[VoiceWebRTC] Añadiendo track de audio a conexión existente con ${peerId}`);
        peer.connection.addTrack(track, this.localStream!);
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

  // Obtener stream local
  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // Habilitar micrófono dinámicamente
  public async enableMicrophone(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true } 
      });
      
      this.localStream = stream;
      
      // Si ya hay conexiones establecidas, necesitamos renegociar
      if (this.peers.size > 0) {
        console.log(`[VoiceWebRTC] Renegociando ${this.peers.size} conexiones existentes después de habilitar micrófono`);
        
        // Añadir tracks a todas las conexiones existentes y renegociar
        const renegotiations = Array.from(this.peers.keys()).map(async (peerId) => {
          // Añadir tracks usando el método dedicado
          this.addTracksToConnection(peerId);
          
          // Pequeño delay para asegurar que los tracks se añadan antes de renegociar
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Crear nueva oferta para renegociar
          console.log(`[VoiceWebRTC] Iniciando renegociación con ${peerId}`);
          await this.createOffer(peerId);
        });
        
        await Promise.all(renegotiations);
        console.log(`[VoiceWebRTC] Renegociación completada para todas las conexiones`);
      }
      
      return true;
    } catch (error) {
      console.error('[VoiceWebRTC] Error al habilitar micrófono:', error);
      return false;
    }
  }

  // Override del método createOffer para asegurar que se añaden los tracks
  public async createOffer(peerId: string): Promise<void> {
    const pc = this.getPeerConnection(peerId);
    
    // SOLUCIÓN: Asegurar que los tracks locales se añadan antes de crear la oferta
    // Esto es crucial para el caso donde el primer usuario activa el micrófono después de estar solo
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
    
    // SOLUCIÓN: Asegurar que los tracks locales se añadan antes de procesar la oferta
    // Esto es crucial para el caso donde el primer usuario activa el micrófono después de estar solo
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