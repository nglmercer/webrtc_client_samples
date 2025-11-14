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
        // ✅ MÁS SERVIDORES STUN GOOGLE
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        
        // ✅ SERVIDORES STUN ALTERNATIVOS
        { urls: 'stun:stun.services.mozilla.com' },
        
        // ✅ SERVIDOR STUN LOCAL (opcional, si tienes uno)
        { urls: 'stun:127.0.0.1:3478' },
        
        // ✅ TURN SERVER (opcional, para casos difíciles)
        // Descomenta si tienes un servidor TURN disponible
        /*
        {
            urls: 'turn:your-turn-server.com:3478',
            username: 'user',
            credential: 'pass'
        }
        */
      ],
      // ✅ MEJOR CONFIGURACIÓN ICE
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all'
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
