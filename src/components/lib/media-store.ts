// media-store.ts

import { map } from 'nanostores';

export interface PeerState {
  status: 'connecting' | 'negotiating' | 'connected' | 'disconnected' | string;
  // CAMBIO CLAVE: Añadimos una propiedad para guardar el stream de video del par.
  stream?: MediaStream | null; 
}

export interface MediaChatState {
  myId: string;
  roomId: string;
  status: string;
  isConnected: boolean;
  isInitiator: boolean;
  isMicEnabled: boolean;
  isCamEnabled: boolean;
  localStream: MediaStream | null;
  peers: Record<string, PeerState>;
}

export const mediaChatStore = map<MediaChatState>({
  myId: '',
  roomId: '',
  status: 'Desconectado',
  isConnected: false,
  isInitiator: false,
  isMicEnabled: true,
  isCamEnabled: true,
  localStream: null,
  peers: {},
});

// --- Acciones del Store ---

export function setPeerState(peerId: string, state: Partial<PeerState>) {
  const currentPeers = mediaChatStore.get().peers;
  mediaChatStore.setKey('peers', {
    ...currentPeers,
    [peerId]: {
      // VALOR INICIAL: Nos aseguramos de que el stream sea null por defecto.
      stream: null, 
      ...(currentPeers[peerId] || {}),
      ...state,
    },
  });
}

export function removePeer(peerId: string) {
  const currentPeers = { ...mediaChatStore.get().peers };
  delete currentPeers[peerId];
  mediaChatStore.setKey('peers', currentPeers);
}