// webrtc-data.ts - Extensión para manejo de datos (chat)

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
    // Para datos, no necesitamos configuración adicional
    // El data channel se maneja en la clase base
    console.log(`[DataWebRTC] Configurando conexión de datos para ${peerId}`);
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
}