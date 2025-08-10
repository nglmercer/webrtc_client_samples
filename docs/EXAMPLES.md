# Ejemplos de Uso - Librería WebRTC Unificada

## Configuración Inicial

### Ejemplo 1: Configuración con Socket.IO (Por Defecto)

```typescript
import { 
  useSocketIO,
  createSignalingChannel,
  createDataManager
} from '../src/components/lib/index.js';

// Configurar Socket.IO como transporte
useSocketIO('http://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000
});

// El resto del código permanece igual
const userParams = { userId: 'user123', roomId: 'room456' };
const callbacks = {
  onConnect: () => console.log('Conectado'),
  onDisconnect: () => console.log('Desconectado'),
  onMessage: (data) => handleMessage(data),
  onUserDisconnected: (userId) => console.log(`${userId} se desconectó`),
  onRoomOwnerChanged: (newOwnerId) => console.log(`Nuevo propietario: ${newOwnerId}`)
};

const signalingChannel = createSignalingChannel(userParams, callbacks);
```

### Ejemplo 2: Configuración con WebSocket Nativo

```typescript
import { 
  useWebSocket,
  createSignalingChannel,
  createDataManager
} from '../src/components/lib/index.js';

// Configurar WebSocket nativo como transporte
useWebSocket('ws://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000,
  compression: true
});

// El resto del código es idéntico al ejemplo anterior
const signalingChannel = createSignalingChannel(userParams, callbacks);
```

## Chat de Texto (Data Channels)

### Ejemplo Completo de Chat

```typescript
import { 
  useSocketIO, // o useWebSocket
  createSignalingChannel,
  createDataManager,
  type DataWebRTCCallbacks,
  type SignalingCallbacks
} from '../src/components/lib/index.js';

// Configurar transporte
useSocketIO('http://localhost:3000');

// Parámetros del usuario
const userParams = {
  userId: 'user_' + Math.random().toString(36).substring(7),
  roomId: 'chat_room_1'
};

// Callbacks para WebRTC
const webrtcCallbacks: DataWebRTCCallbacks = {
  onSignalNeeded: (peerId, signal) => {
    console.log(`Enviando señal a ${peerId}:`, signal);
    signalingChannel.sendSignal(peerId, signal);
  },
  onConnectionStateChange: (peerId, state) => {
    console.log(`Estado de conexión con ${peerId}: ${state}`);
    updatePeerStatus(peerId, state);
  },
  onDataChannelMessage: (peerId, message) => {
    console.log(`Mensaje de ${peerId}: ${message}`);
    displayMessage(peerId, message);
  },
  onPeerDisconnected: (peerId) => {
    console.log(`${peerId} se desconectó`);
    removePeerFromUI(peerId);
  }
};

// Callbacks para signaling
const signalingCallbacks: SignalingCallbacks = {
  onConnect: () => {
    console.log('Conectado al servidor de señalización');
    signalingChannel.checkPresence((isRoomExist) => {
      signalingChannel.openOrJoinRoom(!isRoomExist, (response) => {
        console.log('Respuesta del servidor:', response);
      });
    });
  },
  onDisconnect: () => {
    console.log('Desconectado del servidor');
  },
  onMessage: (data) => {
    handleSignalingMessage(data);
  },
  onUserDisconnected: (userId) => {
    dataManager.closeConnection(userId);
  },
  onRoomOwnerChanged: (newOwnerId) => {
    console.log(`Nuevo propietario de la sala: ${newOwnerId}`);
  }
};

// Crear instancias
const signalingChannel = createSignalingChannel(userParams, signalingCallbacks);
const dataManager = createDataManager(webrtcCallbacks);

// Manejar mensajes de señalización
function handleSignalingMessage(data: any) {
  if (data.message.isWebRTCSignal) {
    const { sender, signal } = data.message;
    
    if (signal.type === 'offer') {
      dataManager.handleOffer(sender, signal);
    } else if (signal.type === 'answer') {
      dataManager.handleAnswer(sender, signal);
    } else if (signal.type === 'candidate') {
      dataManager.addIceCandidate(sender, signal.candidate);
    }
  } else if (data.message.newParticipationRequest) {
    // Nuevo usuario se unió
    const { sender } = data.message;
    console.log(`Nuevo usuario se unió: ${sender}`);
    dataManager.createOffer(sender);
  }
}

// Funciones de UI
function displayMessage(peerId: string, message: string) {
  const chatContainer = document.getElementById('chat-messages');
  const messageElement = document.createElement('div');
  messageElement.innerHTML = `<strong>${peerId}:</strong> ${message}`;
  chatContainer?.appendChild(messageElement);
}

function updatePeerStatus(peerId: string, state: string) {
  const statusElement = document.getElementById(`status-${peerId}`);
  if (statusElement) {
    statusElement.textContent = state;
  }
}

function removePeerFromUI(peerId: string) {
  const peerElement = document.getElementById(`peer-${peerId}`);
  peerElement?.remove();
}

// Enviar mensaje
function sendMessage() {
  const input = document.getElementById('message-input') as HTMLInputElement;
  const message = input.value.trim();
  
  if (message) {
    dataManager.broadcastMessage(message);
    displayMessage('Tú', message);
    input.value = '';
  }
}

// Conectar
signalingChannel.connect();

// Exportar funciones para uso en HTML
(window as any).sendMessage = sendMessage;
```

## Video Conferencia

### Ejemplo Completo de Video Chat

```typescript
import { 
  useWebSocket, // Usando WebSocket para mejor rendimiento en video
  createSignalingChannel,
  createMediaManager,
  type MediaWebRTCCallbacks,
  type SignalingCallbacks
} from '../src/components/lib/index.js';

// Configurar WebSocket
useWebSocket('ws://localhost:3000', {
  compression: true,
  reconnection: true
});

const userParams = {
  userId: 'video_user_' + Math.random().toString(36).substring(7),
  roomId: 'video_room_1'
};

let localStream: MediaStream | null = null;
const remoteVideos = new Map<string, HTMLVideoElement>();

// Callbacks para WebRTC Media
const mediaCallbacks: MediaWebRTCCallbacks = {
  onSignalNeeded: (peerId, signal) => {
    signalingChannel.sendSignal(peerId, signal);
  },
  onConnectionStateChange: (peerId, state) => {
    console.log(`Video conexión con ${peerId}: ${state}`);
    updateVideoStatus(peerId, state);
  },
  onRemoteStreamAdded: (peerId, stream) => {
    console.log(`Stream de video recibido de ${peerId}`);
    addRemoteVideo(peerId, stream);
  },
  onDataChannelMessage: (peerId, message) => {
    // Mensajes de control (mute, unmute, etc.)
    handleControlMessage(peerId, message);
  },
  onPeerDisconnected: (peerId) => {
    removeRemoteVideo(peerId);
  }
};

// Callbacks para signaling (similar al ejemplo anterior)
const signalingCallbacks: SignalingCallbacks = {
  onConnect: () => {
    console.log('Conectado al servidor de video');
    initializeLocalVideo();
  },
  onDisconnect: () => {
    console.log('Desconectado del servidor');
  },
  onMessage: (data) => {
    handleSignalingMessage(data);
  },
  onUserDisconnected: (userId) => {
    mediaManager.closeConnection(userId);
  },
  onRoomOwnerChanged: (newOwnerId) => {
    console.log(`Nuevo propietario: ${newOwnerId}`);
  }
};

const signalingChannel = createSignalingChannel(userParams, signalingCallbacks);
const mediaManager = createMediaManager(mediaCallbacks);

// Inicializar video local
async function initializeLocalVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: true
    });
    
    mediaManager.setLocalStream(localStream);
    
    const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
    localVideo.srcObject = localStream;
    
    // Unirse a la sala después de obtener el stream
    signalingChannel.checkPresence((isRoomExist) => {
      signalingChannel.openOrJoinRoom(!isRoomExist, (response) => {
        console.log('Unido a la sala de video:', response);
      });
    });
    
  } catch (error) {
    console.error('Error al acceder a la cámara:', error);
  }
}

// Agregar video remoto
function addRemoteVideo(peerId: string, stream: MediaStream) {
  let videoElement = remoteVideos.get(peerId);
  
  if (!videoElement) {
    videoElement = document.createElement('video');
    videoElement.id = `video-${peerId}`;
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.muted = false;
    
    const videoContainer = document.getElementById('remote-videos');
    videoContainer?.appendChild(videoElement);
    
    remoteVideos.set(peerId, videoElement);
  }
  
  videoElement.srcObject = stream;
}

// Remover video remoto
function removeRemoteVideo(peerId: string) {
  const videoElement = remoteVideos.get(peerId);
  if (videoElement) {
    videoElement.remove();
    remoteVideos.delete(peerId);
  }
}

// Controles de video
function toggleCamera() {
  const enabled = !mediaManager.isCamEnabled();
  mediaManager.toggleCam(enabled);
  updateCameraButton(enabled);
}

function toggleMicrophone() {
  const enabled = !mediaManager.isMicEnabled();
  mediaManager.toggleMic(enabled);
  updateMicButton(enabled);
}

function updateCameraButton(enabled: boolean) {
  const button = document.getElementById('camera-btn');
  if (button) {
    button.textContent = enabled ? '📹' : '📹❌';
    button.title = enabled ? 'Desactivar cámara' : 'Activar cámara';
  }
}

function updateMicButton(enabled: boolean) {
  const button = document.getElementById('mic-btn');
  if (button) {
    button.textContent = enabled ? '🎤' : '🎤❌';
    button.title = enabled ? 'Silenciar micrófono' : 'Activar micrófono';
  }
}

// Manejar mensajes de señalización (similar al ejemplo de chat)
function handleSignalingMessage(data: any) {
  if (data.message.isWebRTCSignal) {
    const { sender, signal } = data.message;
    
    if (signal.type === 'offer') {
      mediaManager.handleOffer(sender, signal);
    } else if (signal.type === 'answer') {
      mediaManager.handleAnswer(sender, signal);
    } else if (signal.type === 'candidate') {
      mediaManager.addIceCandidate(sender, signal.candidate);
    }
  } else if (data.message.newParticipationRequest) {
    const { sender } = data.message;
    console.log(`Nuevo participante en video: ${sender}`);
    mediaManager.createOffer(sender);
  }
}

function handleControlMessage(peerId: string, message: string) {
  try {
    const control = JSON.parse(message);
    console.log(`Control de ${peerId}:`, control);
    // Manejar mensajes de control como mute/unmute
  } catch (error) {
    console.log(`Mensaje de texto de ${peerId}: ${message}`);
  }
}

function updateVideoStatus(peerId: string, state: string) {
  console.log(`Estado de video con ${peerId}: ${state}`);
}

// Conectar
signalingChannel.connect();

// Exportar funciones para uso en HTML
(window as any).toggleCamera = toggleCamera;
(window as any).toggleMicrophone = toggleMicrophone;
```

## Chat de Voz

### Ejemplo de Voice Chat

```typescript
import { 
  useSocketIO,
  createSignalingChannel,
  createVoiceManager,
  type VoiceWebRTCCallbacks
} from '../src/components/lib/index.js';

// Configurar para voz
useSocketIO('http://localhost:3000');

const userParams = {
  userId: 'voice_user_' + Math.random().toString(36).substring(7),
  roomId: 'voice_room_1'
};

let isListenerOnly = false; // Cambiar a true para usuarios que solo escuchan

const voiceCallbacks: VoiceWebRTCCallbacks = {
  onSignalNeeded: (peerId, signal) => {
    signalingChannel.sendSignal(peerId, signal);
  },
  onConnectionStateChange: (peerId, state) => {
    console.log(`Conexión de voz con ${peerId}: ${state}`);
  },
  onRemoteStreamAdded: (peerId, stream) => {
    console.log(`Audio recibido de ${peerId}`);
    playRemoteAudio(peerId, stream);
  },
  onPeerDisconnected: (peerId) => {
    removeRemoteAudio(peerId);
  }
};

const voiceManager = createVoiceManager(voiceCallbacks);

// Configurar audio local (solo si no es listener)
async function initializeVoice() {
  if (!isListenerOnly) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceManager.setLocalStream(stream);
      console.log('Micrófono configurado');
    } catch (error) {
      console.error('Error al acceder al micrófono:', error);
      isListenerOnly = true; // Fallback a modo escucha
    }
  }
  
  console.log(isListenerOnly ? 'Modo escucha activado' : 'Modo habla activado');
}

function playRemoteAudio(peerId: string, stream: MediaStream) {
  const audio = new Audio();
  audio.srcObject = stream;
  audio.autoplay = true;
  audio.id = `audio-${peerId}`;
  document.body.appendChild(audio);
}

function removeRemoteAudio(peerId: string) {
  const audio = document.getElementById(`audio-${peerId}`);
  audio?.remove();
}

// Controles de voz
function toggleMic() {
  if (!isListenerOnly) {
    const enabled = !voiceManager.isMicEnabled();
    voiceManager.toggleMic(enabled);
    console.log(enabled ? 'Micrófono activado' : 'Micrófono silenciado');
  }
}

// Inicializar
initializeVoice().then(() => {
  signalingChannel.connect();
});
```

## Configuración Híbrida

### Ejemplo: Cambiar Transporte Dinámicamente

```typescript
import { 
  configureWebRTCLib,
  getWebRTCConfig,
  createSignalingChannel
} from '../src/components/lib/index.js';

// Función para detectar el mejor transporte
function detectBestTransport(): 'socketio' | 'websocket' {
  // Lógica para detectar el mejor transporte
  // Por ejemplo, basado en el navegador, red, etc.
  
  if (typeof WebSocket === 'undefined') {
    return 'socketio';
  }
  
  // Preferir WebSocket para mejor rendimiento
  return 'websocket';
}

// Configurar dinámicamente
const transport = detectBestTransport();
const serverUrl = transport === 'websocket' ? 'ws://localhost:3000' : 'http://localhost:3000';

configureWebRTCLib({
  signaling: {
    transport,
    url: serverUrl,
    options: {
      [transport]: {
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 20000
      }
    }
  }
});

console.log('Configuración actual:', getWebRTCConfig());

// Usar normalmente
const signalingChannel = createSignalingChannel(userParams, callbacks);
```

Estos ejemplos muestran cómo usar la nueva librería reorganizada manteniendo la funcionalidad existente pero con mayor flexibilidad en la configuración del transporte.