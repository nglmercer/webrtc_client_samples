// screen-store.ts - Store específico para Screen Sharing

import { map } from 'nanostores';

export interface PeerState {
  status: 'connecting' | 'negotiating' | 'connected' | 'disconnected' | string;
  stream?: MediaStream | null; 
}

export interface ScreenShareState {
  myId: string;
  roomId: string;
  status: string;
  isConnected: boolean;
  isInitiator: boolean;
  isAudioEnabled: boolean;  // Audio del screen sharing
  isVideoEnabled: boolean;  // Video del screen sharing
  isScreenSharing: boolean;   // Estado de screen sharing
  localStream: MediaStream | null;
  peers: Record<string, PeerState>;
}

export const screenShareStore = map<ScreenShareState>({
  myId: '',
  roomId: '',
  status: 'Desconectado',
  isConnected: false,
  isInitiator: false,
  isAudioEnabled: true,
  isVideoEnabled: true,
  isScreenSharing: false,
  localStream: null,
  peers: {},
});

// --- Acciones del Store ---

export function setPeerState(peerId: string, state: Partial<PeerState>) {
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

export function removePeer(peerId: string) {
  const currentPeers = { ...screenShareStore.get().peers };
  delete currentPeers[peerId];
  screenShareStore.setKey('peers', currentPeers);
}
