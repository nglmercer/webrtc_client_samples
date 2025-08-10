# Librería WebRTC Unificada

> **Versión 2.0** - Ahora con soporte para Socket.IO y WebSocket nativo

Una librería completa y flexible para implementar comunicaciones WebRTC con soporte para múltiples tipos de transporte de señalización.

## 🚀 Características Principales

- ✅ **Dual Transport**: Socket.IO y WebSocket nativo
- ✅ **Configuración Centralizada**: Un solo punto de configuración
- ✅ **Modular**: Importa solo lo que necesitas
- ✅ **Compatible**: Mantiene compatibilidad con código existente
- ✅ **TypeScript**: Completamente tipado
- ✅ **Extensible**: Fácil agregar nuevos transportes

## 📦 Instalación Rápida

```typescript
// Importación básica
import { 
  useSocketIO,        // o useWebSocket
  createSignalingChannel,
  createDataManager,
  createMediaManager,
  createVoiceManager
} from './lib/index.js';

// Configurar transporte (una vez)
useSocketIO('http://localhost:3000');  // Socket.IO
// o
useWebSocket('ws://localhost:3000');   // WebSocket nativo

// Usar normalmente
const signalingChannel = createSignalingChannel(userParams, callbacks);
const dataManager = createDataManager(callbacks);
```

## 🏗️ Estructura del Proyecto

```
src/components/lib/
├── core/                    # Funcionalidad base
│   ├── config.ts           # Configuración global
│   └── webrtc-base.ts      # Clase base WebRTC
├── signaling/              # Canales de señalización
│   ├── signaling-factory.ts    # Factory para crear canales
│   ├── socketio-signaling.ts   # Implementación Socket.IO
│   └── websocket-signaling.ts  # Implementación WebSocket
├── webrtc/                 # Implementaciones específicas
│   ├── webrtc-data.ts      # Chat/datos
│   ├── webrtc-media.ts     # Video/audio
│   └── webrtc-voice.ts     # Solo voz
├── utils/                  # Utilidades
│   ├── ws-adapter.ts       # Adaptador WebSocket
│   └── ClientLogger.ts     # Sistema de logging
└── index.ts               # Punto de entrada principal
```

## 📚 Documentación

- **[Documentación Completa](./LIBRARY_DOCUMENTATION.md)** - Guía detallada de uso
- **[Guía de Migración](./MIGRATION_GUIDE.md)** - Cómo migrar desde la versión anterior

## 🔄 Migración desde Versión Anterior

**Antes:**
```typescript
import { SignalingChannel } from './lib/signaling.js';
import { DataWebRTCManager } from './lib/webrtc-data.js';

const signaling = new SignalingChannel(url, userParams, callbacks);
const dataManager = new DataWebRTCManager(callbacks);
```

**Ahora:**
```typescript
import { createSignalingChannel, createDataManager } from './lib/index.js';

const signaling = createSignalingChannel(userParams, callbacks);
const dataManager = createDataManager(callbacks);
```

## 🌟 Ejemplos de Uso

### Chat de Texto
```typescript
import { useSocketIO, createSignalingChannel, createDataManager } from './lib/index.js';

useSocketIO('http://localhost:3000');
const signaling = createSignalingChannel(userParams, callbacks);
const dataManager = createDataManager(callbacks);

dataManager.sendChatMessage('broadcast', 'Hola mundo!');
```

### Video Conferencia
```typescript
import { useWebSocket, createSignalingChannel, createMediaManager } from './lib/index.js';

useWebSocket('ws://localhost:3000');
const signaling = createSignalingChannel(userParams, callbacks);
const mediaManager = createMediaManager(callbacks);

const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
mediaManager.setLocalStream(stream);
```

## ⚙️ Configuración Avanzada

```typescript
import { configureWebRTCLib } from './lib/index.js';

configureWebRTCLib({
  signaling: {
    transport: 'websocket',
    url: 'ws://localhost:3000',
    options: {
      websocket: {
        reconnection: true,
        reconnectionAttempts: 5,
        compression: true
      }
    }
  },
  webrtc: {
    iceServers: {
      iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }]
    }
  }
});
```

## 🔧 Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Construir para producción
npm run build
```

## 📄 Licencia

MIT License - Ver archivo LICENSE para más detalles.

Esta librería proporciona una base común para manejar conexiones WebRTC con extensiones especializadas para diferentes tipos de comunicación.

## Estructura de la Librería

### Archivos Base
- **`webrtc-base.ts`** - Clase base que maneja la funcionalidad común de WebRTC
- **`webrtc-data.ts`** - Extensión para transmisión de datos (chat)
- **`webrtc-voice.ts`** - Extensión para comunicación de voz
- **`webrtc-media.ts`** - Extensión para videollamadas completas
- **`webrtc-example.ts`** - Ejemplos de uso de cada extensión

## Características Principales

### BaseWebRTCManager
La clase base proporciona:
- Manejo de conexiones peer-to-peer
- Gestión de candidatos ICE
- Señalización básica
- Estados de conexión
- Data channels opcionales

### DataWebRTCManager
Especializado para:
- Mensajes de chat grupales
- Mensajes privados
- Transmisión de datos sin audio/video

### VoiceWebRTCManager
Especializado para:
- Comunicación de voz únicamente
- Control de micrófono
- Streams de audio

### MediaWebRTCManager
Especializado para:
- Videollamadas completas
- Control de cámara y micrófono
- Cambio de dispositivos
- Streams de audio y video

## Uso Básico

### 1. Chat de Datos
```typescript
import { DataWebRTCManager, DataWebRTCCallbacks } from './webrtc-data';

const callbacks: DataWebRTCCallbacks = {
  onSignalNeeded: (peerId, signal) => {
    // Enviar señal al servidor
  },
  onConnectionStateChange: (peerId, state) => {
    // Manejar cambios de estado
  },
  onDataChannelMessage: (peerId, message) => {
    // Procesar mensaje de chat
  },
  onPrivateMessage: (fromPeerId, toPeerId, message) => {
    // Procesar mensaje privado
  }
};

const dataManager = new DataWebRTCManager(callbacks);

// Enviar mensaje
dataManager.sendChatMessage('peer1', 'Hola!');
```

### 2. Chat de Voz
```typescript
import { VoiceWebRTCManager, VoiceWebRTCCallbacks } from './webrtc-voice';

const callbacks: VoiceWebRTCCallbacks = {
  onSignalNeeded: (peerId, signal) => {
    // Enviar señal al servidor
  },
  onConnectionStateChange: (peerId, state) => {
    // Manejar cambios de estado
  },
  onRemoteStreamAdded: (peerId, stream) => {
    // Reproducir audio remoto
    const audio = new Audio();
    audio.srcObject = stream;
    audio.play();
  }
};

const voiceManager = new VoiceWebRTCManager(callbacks);

// Configurar micrófono
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    voiceManager.setLocalStream(stream);
    voiceManager.toggleMic(true);
  });
```

### 3. Videollamada
```typescript
import { MediaWebRTCManager, MediaWebRTCCallbacks } from './webrtc-media';

const callbacks: MediaWebRTCCallbacks = {
  onSignalNeeded: (peerId, signal) => {
    // Enviar señal al servidor
  },
  onConnectionStateChange: (peerId, state) => {
    // Manejar cambios de estado
  },
  onRemoteStreamAdded: (peerId, stream) => {
    // Mostrar video remoto
    const video = document.getElementById('remoteVideo') as HTMLVideoElement;
    video.srcObject = stream;
  }
};

const mediaManager = new MediaWebRTCManager(callbacks);

// Configurar cámara y micrófono
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    mediaManager.setLocalStream(stream);
    
    // Mostrar video local
    const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
    localVideo.srcObject = stream;
    
    // Controles
    mediaManager.toggleMic(true);
    mediaManager.toggleCam(true);
  });
```

## Manejo de Señalización

Todas las extensiones requieren el mismo patrón de señalización:

```typescript
// Manejar señales entrantes
function handleSignal(peerId: string, signal: any) {
  if (signal.type === 'offer') {
    manager.handleOffer(peerId, signal);
  } else if (signal.type === 'answer') {
    manager.handleAnswer(peerId, signal);
  } else if (signal.candidate) {
    manager.addIceCandidate(peerId, signal);
  }
}

// Iniciar conexión
manager.createOffer('peer1');
```

## Métodos Comunes

Todos los managers heredan estos métodos de la clase base:

- `createOffer(peerId: string)` - Crear oferta de conexión
- `handleOffer(peerId: string, offer: RTCSessionDescriptionInit)` - Manejar oferta recibida
- `handleAnswer(peerId: string, answer: RTCSessionDescriptionInit)` - Manejar respuesta recibida
- `addIceCandidate(peerId: string, candidate: RTCIceCandidateInit)` - Añadir candidato ICE
- `closeConnection(peerId: string)` - Cerrar conexión específica
- `closeAllConnections()` - Cerrar todas las conexiones

## Métodos Específicos

### DataWebRTCManager
- `sendChatMessage(peerId: string, message: string)` - Enviar mensaje de chat
- `sendPrivateMessage(fromPeerId: string, toPeerId: string, message: string)` - Enviar mensaje privado

### VoiceWebRTCManager
- `setLocalStream(stream: MediaStream)` - Configurar stream local
- `toggleMic(enabled: boolean)` - Controlar micrófono
- `isMicEnabled(): boolean` - Verificar estado del micrófono
- `stopLocalStream()` - Detener stream local

### MediaWebRTCManager
- `setLocalStream(stream: MediaStream)` - Configurar stream local
- `toggleMic(enabled: boolean)` - Controlar micrófono
- `toggleCam(enabled: boolean)` - Controlar cámara
- `isMicEnabled(): boolean` - Verificar estado del micrófono
- `isCamEnabled(): boolean` - Verificar estado de la cámara
- `switchAudioDevice(deviceId: string)` - Cambiar dispositivo de audio
- `switchVideoDevice(deviceId: string)` - Cambiar dispositivo de video
- `stopLocalStream()` - Detener stream local

## Ventajas de esta Estructura

1. **Reutilización de Código** - La lógica común está en la clase base
2. **Especialización** - Cada extensión se enfoca en su funcionalidad específica
3. **Mantenibilidad** - Cambios en la base afectan a todas las extensiones
4. **Escalabilidad** - Fácil añadir nuevas extensiones
5. **Tipado Fuerte** - TypeScript proporciona seguridad de tipos
6. **Flexibilidad** - Puedes usar solo la funcionalidad que necesites

## Migración desde Código Existente

Para migrar código existente:

1. Reemplaza imports de `webrtc.ts` por la extensión apropiada
2. Actualiza los callbacks para usar las nuevas interfaces
3. Usa los métodos específicos de cada extensión
4. Mantén la misma lógica de señalización

Ejemplo de migración:
```typescript
// Antes
import { WebRTCManager } from './webrtc';

// Después
import { MediaWebRTCManager } from './webrtc-media';
```