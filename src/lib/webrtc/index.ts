// index.ts - Punto de entrada principal de la librería WebRTC unificada

// Configuración
export {
  configureWebRTCLib,
  getWebRTCConfig,
  resetWebRTCConfig,
  DEFAULT_CONFIG,
  type WebRTCLibConfig
} from './core/config.js';

// Core WebRTC
export {
  BaseWebRTCManager,
  DEFAULT_ICE_SERVERS,
  type BaseWebRTCCallbacks,
  type PeerData
} from './core/webrtc-base.js';

// Signaling
export {
  SignalingChannelFactory,
  createSignalingChannel,
  SignalingChannel,
  WebSocketSignalingChannel,
  type ISignalingChannel,
  type UserParams,
  type WebRTCSignal,
  type SignalMessage,
  type ParticipationMessage,
  type ReceivedMessage,
  type SignalingCallbacks,
  type RoomParams,
  type SocketMessage
} from './signaling/signaling-factory.js';

// WebRTC específicos
import {
  DataWebRTCManager,
  type DataWebRTCCallbacks
} from './webrtc_spec/webrtc-data.js';

import {
  MediaWebRTCManager,
  type MediaWebRTCCallbacks
} from './webrtc_spec/webrtc-media.js';

import {
  VoiceWebRTCManager,
  type VoiceWebRTCCallbacks
} from './webrtc_spec/webrtc-voice.js';

import {
  ScreenWebRTCManager,
  type ScreenWebRTCCallbacks
} from './webrtc_spec/webrtc-screen.js';

export {
  DataWebRTCManager,
  MediaWebRTCManager,
  VoiceWebRTCManager,
  ScreenWebRTCManager,
  type DataWebRTCCallbacks,
  type MediaWebRTCCallbacks,
  type VoiceWebRTCCallbacks,
  type ScreenWebRTCCallbacks,
}
// Utilidades
export {
  SocketIOLikeClient
} from './utils/ws-adapter.js';

export {
  createClientLogger,
  type ClientLogger,
  type LogLevel,
  type ClientLoggerConfig
} from './utils/ClientLogger.js';

// Funciones de conveniencia para configuración rápida

/**
 * Configura la librería para usar Socket.IO
 * @param serverUrl URL del servidor Socket.IO
 * @param options Opciones adicionales de Socket.IO
 */
export function useSocketIO(serverUrl: string, options?: any): void {
  configureWebRTCLib({
    signaling: {
      transport: 'socketio',
      url: serverUrl,
      options: {
        socketio: options
      }
    }
  });
}

/**
 * Configura la librería para usar WebSocket nativo
 * @param serverUrl URL del servidor WebSocket
 * @param options Opciones adicionales de WebSocket
 */
export function useWebSocket(serverUrl: string, options?: any): void {
  configureWebRTCLib({
    signaling: {
      transport: 'websocket',
      url: serverUrl,
      options: {
        websocket: options
      }
    }
  });
}

/**
 * Crea un manager de datos/chat con la configuración actual
 * @param callbacks Callbacks para eventos
 * @returns Instancia de DataWebRTCManager
 */
export function createDataManager(callbacks: DataWebRTCCallbacks): DataWebRTCManager {
  return new DataWebRTCManager(callbacks);
}

/**
 * Crea un manager de media con la configuración actual
 * @param callbacks Callbacks para eventos
 * @returns Instancia de MediaWebRTCManager
 */
export function createMediaManager(callbacks: MediaWebRTCCallbacks): MediaWebRTCManager {
  return new MediaWebRTCManager(callbacks);
}

/**
 * Crea un manager de voz con la configuración actual
 * @param callbacks Callbacks para eventos
 * @returns Instancia de VoiceWebRTCManager
 */
export function createVoiceManager(callbacks: VoiceWebRTCCallbacks): VoiceWebRTCManager {
  return new VoiceWebRTCManager(callbacks);
}

/**
 * Crea un manager de screen sharing con la configuración actual
 * @param callbacks Callbacks para eventos
 * @returns Instancia de ScreenWebRTCManager
 */
export function createScreenManager(callbacks: ScreenWebRTCCallbacks): ScreenWebRTCManager {
  return new ScreenWebRTCManager(callbacks);
}

// Re-importar configuración para uso directo
import { configureWebRTCLib } from './core/config.js';
