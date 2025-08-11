# Librería WebRTC Unificada - Documentación

## Descripción General

Esta librería proporciona una abstracción unificada para implementar comunicaciones WebRTC con soporte para múltiples tipos de transporte de señalización:

- **Socket.IO** (por defecto, para compatibilidad)
- **WebSocket nativo** (implementación ligera)

## Estructura del Proyecto

```
src/components/lib/
├── core/                    # Funcionalidad base
│   ├── config.ts           # Configuración global
│   └── webrtc-base.ts      # Clase base WebRTC
├── signaling/              # Canales de señalización
│   ├── signaling-factory.ts    # Factory para crear canales
│   ├── socketio-signaling.ts   # Implementación Socket.IO
│   └── websocket-signaling.ts  # Implementación WebSocket
├── webrtc_spec/                 # Implementaciones específicas
│   ├── webrtc-data.ts      # Chat/datos
│   ├── webrtc-media.ts     # Video/audio
│   └── webrtc-voice.ts     # Solo voz
├── utils/                  # Utilidades
│   ├── ws-adapter.ts       # Adaptador WebSocket
│   └── ClientLogger.ts     # Sistema de logging
└── index.ts               # Punto de entrada principal
```

## Instalación y Configuración

### Importación Básica

```typescript
import { 
  configureWebRTCLib, 
  useSocketIO, 
  useWebSocket,
  createSignalingChannel,
  createDataManager,
  createMediaManager,
  createVoiceManager
} from './lib/index.js';
```

### Configuración con Socket.IO (Por Defecto)

```typescript
// Configuración simple
useSocketIO('http://localhost:3000');

// Configuración avanzada
useSocketIO('http://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000
});
```

### Configuración con WebSocket Nativo

```typescript
// Configuración simple
useWebSocket('ws://localhost:3000');

// Configuración avanzada
useWebSocket('ws://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 20000,
  compression: true
});
```

### Configuración Manual Completa

```typescript
configureWebRTCLib({
  signaling: {
    transport: 'websocket', // o 'socketio'
    url: 'ws://localhost:3000',
    options: {
      websocket: {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      }
    }
  },
  webrtc: {
    iceServers: {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] }
      ]
    },
    enableLogging: true
  }
});
```

## Uso de la Librería

### 1. Chat/Datos (WebRTC Data Channels)

```typescript
import { createDataManager, createSignalingChannel } from './lib/index.js';

// Configurar callbacks
const callbacks = {
  onSignalNeeded: (peerId, signal) => {
    signalingChannel.sendSignal(peerId, signal);
  },
  onConnectionStateChange: (peerId, state) => {
    console.log(`Conexión con ${peerId}: ${state}`);
  },
  onDataChannelMessage: (peerId, message) => {
    console.log(`Mensaje de ${peerId}: ${message}`);
  },
  onPeerDisconnected: (peerId) => {
    console.log(`${peerId} se desconectó`);
  }
};

// Crear manager de datos
const dataManager = createDataManager(callbacks);

// Configurar signaling
const signalingCallbacks = {
  onConnect: () => console.log('Conectado al servidor'),
  onDisconnect: () => console.log('Desconectado del servidor'),
  onMessage: (data) => {
    if (data.message.isWebRTCSignal) {
      const { sender, signal } = data.message;
      if (signal.type === 'offer') {
        dataManager.handleOffer(sender, signal);
      } else if (signal.type === 'answer') {
        dataManager.handleAnswer(sender, signal);
      } else if (signal.type === 'candidate') {
        dataManager.addIceCandidate(sender, signal.candidate);
      }
    }
  },
  onUserDisconnected: (userId) => {
    dataManager.closeConnection(userId);
  },
  onRoomOwnerChanged: (newOwnerId) => {
    console.log(`Nuevo propietario: ${newOwnerId}`);
  }
};

const signalingChannel = createSignalingChannel(
  { userId: 'user123', roomId: 'room456' },
  signalingCallbacks
);

// Conectar
signalingChannel.connect();

// Enviar mensaje de chat
dataManager.sendChatMessage('broadcast', 'Hola a todos!');
```

### 2. Video/Audio

```typescript
import { createMediaManager, createSignalingChannel } from './lib/index.js';

// Obtener stream local
const localStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
});

// Configurar callbacks
const callbacks = {
  onSignalNeeded: (peerId, signal) => {
    signalingChannel.sendSignal(peerId, signal);
  },
  onConnectionStateChange: (peerId, state) => {
    console.log(`Conexión con ${peerId}: ${state}`);
  },
  onRemoteStreamAdded: (peerId, stream) => {
    // Mostrar video remoto
    const videoElement = document.getElementById(`video-${peerId}`);
    videoElement.srcObject = stream;
  }
};

// Crear manager de media
const mediaManager = createMediaManager(callbacks);
mediaManager.setLocalStream(localStream);

// Mostrar video local
const localVideo = document.getElementById('localVideo');
localVideo.srcObject = localStream;

// Controles
mediaManager.toggleMic(false); // Silenciar micrófono
mediaManager.toggleCam(true);  // Activar cámara
```

### 3. Solo Voz

```typescript
import { createVoiceManager, createSignalingChannel } from './lib/index.js';

// Para usuarios que hablan
const localStream = await navigator.mediaDevices.getUserMedia({
  audio: true
});

// Para usuarios que solo escuchan
// const localStream = null;

const callbacks = {
  onSignalNeeded: (peerId, signal) => {
    signalingChannel.sendSignal(peerId, signal);
  },
  onConnectionStateChange: (peerId, state) => {
    console.log(`Conexión de voz con ${peerId}: ${state}`);
  },
  onRemoteStreamAdded: (peerId, stream) => {
    // Reproducir audio remoto
    const audioElement = new Audio();
    audioElement.srcObject = stream;
    audioElement.play();
  }
};

const voiceManager = createVoiceManager(callbacks);
if (localStream) {
  voiceManager.setLocalStream(localStream);
}
```

## Migración desde la Versión Anterior

### Cambios en las Importaciones

**Antes:**
```typescript
import { SignalingChannel } from './lib/signaling.js';
import { DataWebRTCManager } from './lib/webrtc-data.js';
```

**Ahora:**
```typescript
import { 
  createSignalingChannel, 
  createDataManager 
} from './lib/index.js';
```

### Configuración de Transporte

**Socket.IO (comportamiento anterior):**
```typescript
// No requiere cambios, es el comportamiento por defecto
const signalingChannel = createSignalingChannel(userParams, callbacks);
```

**WebSocket nativo (nuevo):**
```typescript
// Configurar antes de crear el canal
useWebSocket('ws://localhost:3000');
const signalingChannel = createSignalingChannel(userParams, callbacks);
```

## API Reference

### Configuración

- `configureWebRTCLib(config)` - Configuración manual completa
- `useSocketIO(url, options?)` - Configurar Socket.IO
- `useWebSocket(url, options?)` - Configurar WebSocket
- `getWebRTCConfig()` - Obtener configuración actual
- `resetWebRTCConfig()` - Resetear a valores por defecto

### Factories

- `createSignalingChannel(userParams, callbacks, serverUrl?)` - Crear canal de señalización
- `createDataManager(callbacks)` - Crear manager de datos
- `createMediaManager(callbacks)` - Crear manager de media
- `createVoiceManager(callbacks)` - Crear manager de voz

### Managers WebRTC

Todos los managers heredan de `BaseWebRTCManager` y comparten métodos básicos:

- `createOffer(peerId)` - Crear oferta WebRTC
- `handleOffer(peerId, offer)` - Manejar oferta recibida
- `handleAnswer(peerId, answer)` - Manejar respuesta recibida
- `addIceCandidate(peerId, candidate)` - Añadir candidato ICE
- `closeConnection(peerId)` - Cerrar conexión específica
- `closeAllConnections()` - Cerrar todas las conexiones
- `getConnectionState(peerId)` - Obtener estado de conexión
- `getConnectedPeers()` - Obtener lista de peers conectados

## Ventajas de la Nueva Estructura

1. **Flexibilidad de Transporte**: Soporte para Socket.IO y WebSocket nativo
2. **Organización Mejorada**: Código separado por responsabilidades
3. **Compatibilidad**: Mantiene la API existente
4. **Extensibilidad**: Fácil agregar nuevos tipos de transporte
5. **Configuración Centralizada**: Un solo punto para configurar toda la librería
6. **Tree Shaking**: Importa solo lo que necesitas

## Ejemplos Completos

Ver la carpeta `examples/` para implementaciones completas de:
- Chat de texto
- Video conferencia
- Chat de voz
- Configuraciones híbridas