// screen-share-store.ts

import { map } from 'nanostores';

export interface ScreenSharePeerState {
  status: 'connecting' | 'negotiating' | 'connected' | 'disconnected' | string;
  stream?: MediaStream | null; 
}

export interface ScreenShareState {
  myId: string;
  roomId: string;
  status: string;
  isConnected: boolean;
  isInitiator: boolean;
  isMicEnabled: boolean;
  isScreenSharing: boolean;
  localStream: MediaStream | null;
  peers: Record<string, ScreenSharePeerState>;
}

export const screenShareStore = map<ScreenShareState>({
  myId: '',
  roomId: '',
  status: 'Desconectado',
  isConnected: false,
  isInitiator: false,
  isMicEnabled: false,
  isScreenSharing: false,
  localStream: null,
  peers: {},
});

// --- Acciones del Store ---

export function setScreenSharePeerState(peerId: string, state: Partial<ScreenSharePeerState>) {
  const currentPeers = screenShareStore.get().peers;
  screenShareStore.setKey('peers', {
    ...currentPeers,
    [peerId]: {
      stream: null, 
      ...(currentPeers[peerId] || {}),
      ...state,
    },
  });
}

export function removeScreenSharePeer(peerId: string) {
  const currentPeers = { ...screenShareStore.get().peers };
  delete currentPeers[peerId];
  screenShareStore.setKey('peers', currentPeers);
}
