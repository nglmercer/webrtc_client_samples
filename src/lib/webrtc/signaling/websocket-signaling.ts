// websocket-signaling.ts - Implementación de signaling usando WebSocket nativo

import { SocketIOLikeClient } from '../utils/ws-adapter.js';
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
    ParticipationMessage,
    SignalMessage,
    SignalData
} from './types.js';

interface WebSocketSignalingOptions {
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
}

export class WebSocketSignalingChannel {
    public socket: SocketIOLikeClient | null = null;
    public serverUrl: string;
    public userParams: UserParams;
    public callbacks: SignalingCallbacks;
    private options: WebSocketSignalingOptions;

    constructor(serverUrl: string, userParams: UserParams, callbacks: SignalingCallbacks, options: WebSocketSignalingOptions = {}) {
        this.serverUrl = serverUrl;
        this.userParams = userParams;
        this.callbacks = callbacks;
        this.options = {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 20000,
            autoConnect: true,
            ...options
        };
    }

    public connect(): void {
        // Configurar query parameters para compatibilidad con el servidor
        const query = {
            userid: this.userParams.userId,
            sessionid: this.userParams.roomId,
            ...this.options.query
        };

        this.socket = new SocketIOLikeClient(this.serverUrl, {
            query,
            auth: this.options.auth,
            autoConnect: this.options.autoConnect,
            forceNew: this.options.forceNew,
            multiplex: this.options.multiplex,
            reconnection: this.options.reconnection,
            reconnectionAttempts: this.options.reconnectionAttempts,
            reconnectionDelay: this.options.reconnectionDelay,
            reconnectionDelayMax: this.options.reconnectionDelayMax,
            randomizationFactor: this.options.randomizationFactor,
            timeout: this.options.timeout,
            protocols: this.options.protocols,
            headers: this.options.headers,
            compression: this.options.compression,
            maxPayload: this.options.maxPayload,
            pingInterval: this.options.pingInterval,
            pongTimeout: this.options.pongTimeout
        });

        // Configurar eventos usando la API compatible con Socket.IO
        this.socket.on('connect', this.callbacks.onConnect);
        this.socket.on('disconnect', this.callbacks.onDisconnect);
        
        this.socket.on('RTCMultiConnection-Message', (data: any) => {
            this.callbacks.onMessage(data);
        });
        
        this.socket.on('user-disconnected', (userId: string) => {
            this.callbacks.onUserDisconnected(userId);
        });
        
        this.socket.on('room-owner-changed', (newOwnerId: string) => {
            this.callbacks.onRoomOwnerChanged(newOwnerId);
        });
    }
    
    public checkPresence(callback: (isRoomExist: boolean) => void): void {
        if (!this.socket) {
            console.error("Socket no conectado.");
            return;
        }
        this.socket.emit('check-presence', this.userParams.roomId, callback);
    }

    public openOrJoinRoom(isInitiator: boolean, callback: (response: any) => void): void {
        if (!this.socket) {
            console.error("Socket no conectado.");
            return;
        }
        const action = isInitiator ? 'open-room' : 'join-room';
        const params: RoomParams = { 
            sessionid: this.userParams.roomId, 
            extra: { name: this.userParams.roomId } 
        };
        this.socket.emit(action, params, callback);
    }
    
    public sendNewParticipationRequest(roomId: string): void {
        const message: ParticipationMessage = {
            newParticipationRequest: true,
            sender: this.userParams.userId
        };
        this.sendMessage(roomId, message);
    }

    public sendSignal(peerId: string, signal: WebRTCSignal): void {
        const message: SignalMessage = {
            isWebRTCSignal: true,
            sender: this.userParams.userId,
            signal: signal
        };
        this.sendMessage(peerId, message);
    }

    public sendMessage(remoteUserId: string, message: ReceivedMessage): void {
        if (!this.socket) {
            console.error("Socket no conectado.");
            return;
        }
        const payload: SocketMessage = { remoteUserId, message };
        this.socket.emit('RTCMultiConnection-Message', payload);
    }

    public disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // Métodos adicionales para compatibilidad
    public isConnected(): boolean {
        return this.socket !== null;
    }

    public getConnectionState(): string {
        if (!this.socket) return 'disconnected';
        // El ws-adapter maneja internamente el estado de conexión
        return 'connected'; // Simplificado para compatibilidad
    }
}