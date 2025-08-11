import { map, atom } from 'nanostores';

// Tipo para un mensaje en el chat
export interface Message {
  senderId: string;
  senderName: string; // Guardaremos el nombre para mostrarlo
  text: string;
  timestamp: number;
}

// Tipo para el estado de un par (peer)
export interface PeerState {
  status: 'negotiating' | 'connected' | 'disconnected';
  // Podrías añadir más info como su nombre de usuario si lo envías al conectar
}
export interface VoiceChatState {
  myId: string;
  roomId: string;
  status: string;
  isConnected: boolean; // Conexión con el servidor de señalización
  isInitiator: boolean;
  isMicEnabled: boolean;
  localStream: MediaStream | null;
  peers: Record<string, PeerState>;
}
// El store principal de nuestra aplicación
export const chatStore = map({
  myId: '',
  roomId: '',
  status: 'Inicializando...',
  isConnected: false,
  isInitiator: false,
  peers: {} as Record<string, PeerState>, // Objeto de pares conectados
  messages: [] as Message[],
});
export const voiceChatStore = map<VoiceChatState>({
  myId: '',
  roomId: '',
  status: 'Esperando...',
  isConnected: false,
  isInitiator: false,
  isMicEnabled: true,
  localStream: null,
  peers: {},
});
// Función para añadir un nuevo mensaje al store
export function addMessage(message: Message) {
  chatStore.setKey('messages', [...chatStore.get().messages, message]);
}

// Función para actualizar el estado de un par en chatStore
export function setPeerState(peerId: string, state: Partial<PeerState>) {
    const currentPeers = chatStore.get().peers;
    chatStore.setKey('peers', {
        ...currentPeers,
        [peerId]: {
            ...(currentPeers[peerId] || { status: 'negotiating' }),
            ...state
        }
    });
}

// Función para actualizar el estado de un par en voiceChatStore
export function setVoicePeerState(peerId: string, state: Partial<PeerState>) {
    const currentPeers = voiceChatStore.get().peers;
    voiceChatStore.setKey('peers', {
        ...currentPeers,
        [peerId]: {
            ...(currentPeers[peerId] || { status: 'negotiating' }),
            ...state
        }
    });
}

// Función para eliminar un par de chatStore
export function removePeer(peerId: string) {
    const currentPeers = { ...chatStore.get().peers };
    delete currentPeers[peerId];
    chatStore.setKey('peers', currentPeers);
}

// Función para eliminar un par de voiceChatStore
export function removeVoicePeer(peerId: string) {
    const currentPeers = { ...voiceChatStore.get().peers };
    delete currentPeers[peerId];
    voiceChatStore.setKey('peers', currentPeers);
}