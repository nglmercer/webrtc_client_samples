// config.ts - Configuración global de la librería WebRTC

export interface WebRTCLibConfig {
  // Tipo de transporte para señalización
  signaling: {
    transport: 'socketio' | 'websocket';
    url: string;
    options?: {
      // Opciones específicas para Socket.IO
      socketio?: {
        query?: { [key: string]: string };
        transports?: string[];
        autoConnect?: boolean;
        auth?: Record<string, any>;
        forceNew?: boolean;
        multiplex?: boolean;
        reconnection?: boolean;
        reconnectionAttempts?: number;
        reconnectionDelay?: number;
        reconnectionDelayMax?: number;
        randomizationFactor?: number;
        timeout?: number;
      };
      // Opciones específicas para WebSocket nativo
      websocket?: {
        query?: { [key: string]: string };
        autoConnect?: boolean;
        auth?: Record<string, any>;
        forceNew?: boolean;
        multiplex?: boolean;
        reconnection?: boolean;
        reconnectionAttempts?: number;
        reconnectionDelay?: number;
        reconnectionDelayMax?: number;
        randomizationFactor?: number;
        timeout?: number;
        protocols?: string | string[];
        headers?: Record<string, string>;
        compression?: boolean;
        maxPayload?: number;
        pingInterval?: number;
        pongTimeout?: number;
      };
    };
  };
  
  // Configuración de WebRTC
  webrtc: {
    iceServers?: RTCConfiguration;
    enableLogging?: boolean;
  };
}

// Configuración por defecto
export const DEFAULT_CONFIG: WebRTCLibConfig = {
  signaling: {
    transport: 'socketio', // Por defecto usa Socket.IO para compatibilidad
    url: 'http://localhost:3000',
    options: {
      socketio: {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      },
      websocket: {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      }
    }
  },
  webrtc: {
    iceServers: {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
      ]
    },
    enableLogging: true
  }
};

// Configuración global de la librería
let globalConfig: WebRTCLibConfig = { ...DEFAULT_CONFIG };

// Función para configurar la librería
export function configureWebRTCLib(config: Partial<WebRTCLibConfig>): void {
  globalConfig = {
    ...globalConfig,
    ...config,
    signaling: {
      ...globalConfig.signaling,
      ...config.signaling,
      options: {
        ...globalConfig.signaling.options,
        ...config.signaling?.options
      }
    },
    webrtc: {
      ...globalConfig.webrtc,
      ...config.webrtc
    }
  };
}

// Función para obtener la configuración actual
export function getWebRTCConfig(): WebRTCLibConfig {
  return { ...globalConfig };
}

// Función para resetear la configuración a los valores por defecto
export function resetWebRTCConfig(): void {
  globalConfig = { ...DEFAULT_CONFIG };
}