// signaling.ts
import { io, Socket } from 'socket.io-client';

// TS-NOTE: Todas las interfaces que definían la estructura de datos ahora son tipos de TypeScript.
// Esto previene errores al construir o recibir mensajes.

interface UserParams {
    userId: string;
    roomId: string;
}

// TS-NOTE: Definimos los tipos de señal WebRTC para reutilizarlos.
type WebRTCSignal = RTCSessionDescriptionInit | RTCIceCandidateInit;

// TS-NOTE: Interfaces para los diferentes tipos de mensajes que se pueden enviar.
interface SignalMessage {
    isWebRTCSignal: true; // Usamos un literal para que TS pueda diferenciar los tipos de mensaje.
    sender: string;
    signal: WebRTCSignal;
}

interface ParticipationMessage {
    newParticipationRequest: true;
    sender: string;
}

// TS-NOTE: Un tipo de unión para todos los posibles mensajes que se pueden recibir.
type ReceivedMessage = SignalMessage | ParticipationMessage | { [key: string]: any };

interface Callbacks {
    onConnect: () => void;
    onDisconnect: () => void;
    onMessage: (data: any) => void;
    onUserDisconnected: (userId: string) => void;
    onNewUserJoined?: (userData: ParticipationMessage) => void;
    onRoomOwnerChanged: (newOwnerId: string) => void;
}

interface RoomParams {
    sessionid: string;
    extra: {
        name: string;
        [key: string]: any; // Permite propiedades adicionales.
    };
}

interface SocketMessage {
    remoteUserId: string;
    message: ReceivedMessage;
}

export class SignalingChannel {
    // TS-NOTE: Tipamos las propiedades privadas para encapsular y proteger el estado interno.
    private socket: Socket | null = null;
    private serverUrl: string;
    private userParams: UserParams;
    private callbacks: Callbacks;

    constructor(serverUrl: string, userParams: UserParams, callbacks: Callbacks) {
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
        const params: RoomParams = { sessionid: this.userParams.roomId, extra: { name: 'Usuario' } };
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

    private sendMessage(remoteUserId: string, message: ReceivedMessage): void {
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