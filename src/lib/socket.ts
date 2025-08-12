import { SocketIOLikeClient } from "../lib/webrtc/utils/ws-adapter";
import type { RoomsResponse, RoomListItem } from '../lib/types/room';
import apiConfig from "../lib/apiConfig";
import { emitter } from "./Emitter";

// Instancia global del socket
const io = new SocketIOLikeClient(apiConfig.getFullUrl());
let isConnected = false;

// Inicializar conexión
io.connect();

// Event listeners del socket
io.on('connect', () => {
    console.log("Conectado al servidor WebSocket");
    isConnected = true;
    emitter.emit('connectionStatus', true);
    
    // Solicitar salas iniciales al conectar
    requestRooms();
});

io.on('disconnect', () => {
    console.log("Desconectado del servidor WebSocket");
    isConnected = false;
    emitter.emit('connectionStatus', false);
});

io.on('error', (error: any) => {
    console.error('Error de WebSocket:', error);
    emitter.emit('roomsError', 'Error de conexión con el servidor');
});

// Event listeners del emitter
emitter.on('requestRooms', () => {
    requestRooms();
});

emitter.on('requestReconnect', () => {
    reconnect();
});

// Funciones principales
function requestRooms() {
    if (!isConnected) {
        emitter.emit('roomsError', 'No hay conexión disponible');
        return;
    }
    
    try {
        io.emit('GetRooms', (rooms: RoomsResponse) => {
            try {
                const roomList = transformRoomsData(rooms);
                emitter.emit('rooms', roomList);
                console.log("Salas obtenidas:", { rooms, roomList });
            } catch (error) {
                console.error('Error al procesar salas:', error);
                emitter.emit('roomsError', 'Error al procesar las salas');
            }
        });
    } catch (error) {
        console.error('Error al solicitar salas:', error);
        emitter.emit('roomsError', 'Error al solicitar las salas');
    }
}

const transformRoomsData = (rooms: RoomsResponse): RoomListItem[] => {
    return Object.entries(rooms).map(([roomName, room]) => ({
        name: room.extra.name || roomName,
        owner: room.owner,
        participantCount: room.participants.length,
        maxParticipants: room.maxParticipantsAllowed,
        createdAt: room.createdAt,
        canJoin: room.participants.length < room.maxParticipantsAllowed
    }));
};

// Función para reconectar
function reconnect() {
    console.log('Intentando reconectar...');
    if (isConnected) {
        io.disconnect();
    }
    
    setTimeout(() => {
        io.connect();
    }, 1000);
}

// Exportar funciones para uso externo
export { io, requestRooms, isConnected, reconnect };

// Función para emitir eventos personalizados al socket
export function emitToSocket(event: string, data?: any, callback?: Function) {
    if (!isConnected) {
        console.warn('Socket no conectado. No se puede emitir evento:', event);
        return false;
    }
    
    if (callback) {
        io.emit(event, data, callback);
    } else {
        io.emit(event, data);
    }
    return true;
}

// Función para suscribirse a eventos del socket
export function onSocketEvent(event: string, handler: (...args: any[]) => void) {
    io.on(event, handler);
}

// Función para desuscribirse de eventos del socket
export function offSocketEvent(event: string, handler?: (...args: any[]) => void) {
    if (handler) {
        io.off(event, handler);
    } else {
        io.off(event);
    }
}