// signaling.ts
import { io, Socket } from 'socket.io-client';
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

// TS-NOTE: Todas las interfaces que definían la estructura de datos ahora son tipos de TypeScript.
// Esto previene errores al construir o recibir mensajes.

// Re-exportar tipos para compatibilidad
export type {
    ParticipationMessage,
    SignalMessage,
    SignalData
} from './types.js';

export class SignalingChannel {
    // TS-NOTE: Tipamos las propiedades para mantener compatibilidad con la interfaz
    public socket: Socket | null = null;
    public serverUrl: string;
    public userParams: UserParams;
    public callbacks: SignalingCallbacks;

    constructor(serverUrl: string, userParams: UserParams, callbacks: SignalingCallbacks) {
        this.serverUrl = serverUrl;
        this.userParams = userParams;
        this.callbacks = callbacks;
    }

    public connect(): void {
        this.socket = io(this.serverUrl, {
            query: { userid: this.userParams.userId, sessionid: this.userParams.roomId }
        });

        this.socket.on('connect', this.callbacks.onConnect);
        this.socket.on('disconnect', this.callbacks.onDisconnect);
       
        // TS-NOTE: Al recibir un mensaje, lo casteamos a nuestro tipo 'ReceivedMessage' para un manejo seguro.
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
        const params: RoomParams = { sessionid: this.userParams.roomId, extra: { name: this.userParams.roomId } };
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
}