// signaling-factory.ts - Factory para crear canales de señalización

import { getWebRTCConfig } from '../core/config.js';
import { SignalingChannel } from './socketio-signaling.js';
import { WebSocketSignalingChannel } from './websocket-signaling.js';
import type {
    UserParams,
    WebRTCSignal,
    ParticipationMessage,
    SignalMessage,
    ReceivedMessage,
    SignalData,
    SignalingCallbacks,
    RoomParams,
    SocketMessage
} from './types.js';

// Re-exportar tipos para compatibilidad
export type {
    UserParams,
    WebRTCSignal,
    ParticipationMessage,
    SignalMessage,
    ReceivedMessage,
    SignalData,
    SignalingCallbacks,
    RoomParams,
    SocketMessage
} from './types.js';

// Interfaz común para ambos tipos de signaling
export interface ISignalingChannel {
    connect(): void;
    checkPresence(callback: (isRoomExist: boolean) => void): void;
    openOrJoinRoom(isInitiator: boolean, callback: (response: any) => void): void;
    sendNewParticipationRequest(roomId: string): void;
    sendSignal(peerId: string, signal: WebRTCSignal): void;
    disconnect(): void;
    isConnected?(): boolean;
    getConnectionState?(): string;
    sendMessage(remoteUserId: string, message: ReceivedMessage): void;
    // Propiedades compatibles con SignalingChannel original
    socket?: any;
    serverUrl?: string;
    userParams?: UserParams;
    callbacks?: SignalingCallbacks;
}

// Factory para crear el canal de señalización apropiado
export class SignalingChannelFactory {
    /**
     * Crea un canal de señalización basado en la configuración global
     * @param userParams Parámetros del usuario
     * @param callbacks Callbacks para eventos
     * @param serverUrl URL del servidor (opcional, usa la configuración global si no se proporciona)
     * @returns Instancia del canal de señalización
     */
    static create(
        userParams: UserParams, 
        callbacks: SignalingCallbacks, 
        serverUrl?: string
    ): ISignalingChannel {
        const config = getWebRTCConfig();
        const url = serverUrl || config.signaling.url;
        const transport = config.signaling.transport;

        switch (transport) {
            case 'websocket':
                return new WebSocketSignalingChannel(
                    url, 
                    userParams, 
                    callbacks, 
                    config.signaling.options?.websocket
                );
            
            case 'socketio':
            default:
                return new SignalingChannel(
                    url, 
                    userParams, 
                    callbacks
                );
        }
    }

    /**
     * Crea un canal de señalización específico de Socket.IO
     * @param serverUrl URL del servidor
     * @param userParams Parámetros del usuario
     * @param callbacks Callbacks para eventos
     * @returns Instancia del canal Socket.IO
     */
    static createSocketIO( 
        serverUrl: string,
        userParams: UserParams, 
        callbacks: SignalingCallbacks
    ): SignalingChannel {
        return new SignalingChannel(serverUrl, userParams, callbacks);
    }

    /**
     * Crea un canal de señalización específico de WebSocket
     * @param serverUrl URL del servidor
     * @param userParams Parámetros del usuario
     * @param callbacks Callbacks para eventos
     * @param options Opciones específicas de WebSocket
     * @returns Instancia del canal WebSocket
     */
    static createWebSocket(
        serverUrl: string,
        userParams: UserParams, 
        callbacks: SignalingCallbacks,
        options?: any
    ): WebSocketSignalingChannel {
        return new WebSocketSignalingChannel(serverUrl, userParams, callbacks, options);
    }
}

// Función de conveniencia para crear un canal con la configuración por defecto
export function createSignalingChannel(
    userParams: UserParams, 
    callbacks: SignalingCallbacks, 
    serverUrl?: string
): ISignalingChannel {
    return SignalingChannelFactory.create(userParams, callbacks, serverUrl);
}

// Re-exportar las clases para compatibilidad
export { SignalingChannel } from './socketio-signaling.js';
export { WebSocketSignalingChannel } from './websocket-signaling.js';