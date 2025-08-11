// types.ts - Tipos compartidos para signaling
import { Socket as SocketIO } from 'socket.io-client';
import { SocketIOLikeClient } from '../utils/ws-adapter.js';
// Interfaces comunes para todos los tipos de signaling
export interface UserParams {
    userId: string;
    roomId: string;
}

export type WebRTCSignal = RTCSessionDescriptionInit | RTCIceCandidateInit;

export interface ParticipationMessage {
    newParticipationRequest?: boolean;
    isWebRTCSignal?: boolean;
    sender: string;
}

export interface SignalMessage extends ParticipationMessage {
    isWebRTCSignal?: boolean;
    signal?: WebRTCSignal;
    sender: string;
}

export type ReceivedMessage = SignalMessage | { [key: string]: any };


export interface SignalData {
    extra: { [key: string]: any; };
    message: ReceivedMessage;
    sender: string;
    isWebRTCSignal: boolean;
}

export interface SignalingCallbacks {
    onConnect: () => void;
    onDisconnect: () => void;
    onMessage: (data: SignalData) => void;
    onUserDisconnected: (userId: string) => void;
    onNewUserJoined?: (userData: ParticipationMessage) => void;
    onRoomOwnerChanged: (newOwnerId: string) => void;
}

export interface RoomParams {
    sessionid: string;
    extra: {
        name: string;
        [key: string]: any;
    };
}

export interface SocketMessage {
    remoteUserId: string;
    message: ReceivedMessage;
}
export type Socket = SocketIO | SocketIOLikeClient | null;
