# Guía de Migración - Librería WebRTC Unificada

## Resumen de Cambios

La librería WebRTC ha sido reorganizada para soportar múltiples tipos de transporte de señalización manteniendo compatibilidad con el código existente.

### Nuevas Características

✅ **Soporte para WebSocket nativo** - Alternativa ligera a Socket.IO  
✅ **Configuración centralizada** - Un solo punto para configurar toda la librería  
✅ **Estructura modular** - Código organizado por responsabilidades  
✅ **Compatibilidad hacia atrás** - El código existente sigue funcionando  
✅ **Factory pattern** - Creación simplificada de componentes  

## Estructura Anterior vs Nueva

### Antes
```
src/components/lib/
├── signaling.ts
├── webrtc-base.ts
├── webrtc-data.ts
├── webrtc-media2.ts
├── webrtc-voice2.ts
└── adapters/
    ├── ws-adapter.ts
    └── ClientLogger.ts
```

### Ahora
```
src/components/lib/
├── core/
│   ├── config.ts
│   └── webrtc-base.ts
├── signaling/
│   ├── signaling-factory.ts
│   ├── socketio-signaling.ts
│   └── websocket-signaling.ts
├── webrtc/
│   ├── webrtc-data.ts
│   ├── webrtc-media.ts
│   └── webrtc-voice.ts
├── utils/
│   ├── ws-adapter.ts
│   └── ClientLogger.ts
└── index.ts
```

## Migración Paso a Paso

### 1. Actualizar Importaciones

**Antes:**
```typescript
import { SignalingChannel } from './lib/signaling.js';
import { DataWebRTCManager } from './lib/webrtc-data.js';
import { MediaWebRTCManager } from './lib/webrtc-media2.js';
import { VoiceWebRTCManager } from './lib/webrtc-voice2.js';
```

**Ahora (Opción 1 - Importación unificada):**
```typescript
import { 
  createSignalingChannel,
  createDataManager,
  createMediaManager,
  createVoiceManager,
  useSocketIO // o useWebSocket
} from './lib/index.js';
```

**Ahora (Opción 2 - Importaciones específicas):**
```typescript
import { SignalingChannelFactory } from './lib/signaling/signaling-factory.js';
import { DataWebRTCManager } from './lib/webrtc/webrtc-data.js';
import { MediaWebRTCManager } from './lib/webrtc/webrtc-media.js';
import { VoiceWebRTCManager } from './lib/webrtc/webrtc-voice.js';
```

### 2. Configurar el Transporte

**Para mantener Socket.IO (sin cambios):**
```typescript
// No requiere configuración adicional, es el comportamiento por defecto
const signalingChannel = createSignalingChannel(userParams, callbacks);
```

**Para usar WebSocket nativo:**
```typescript
// Configurar una vez al inicio de la aplicación
useWebSocket('ws://localhost:3000');

// Luego usar normalmente
const signalingChannel = createSignalingChannel(userParams, callbacks);
```

### 3. Actualizar Creación de Componentes

**Antes:**
```typescript
const signalingChannel = new SignalingChannel(serverUrl, userParams, callbacks);
const dataManager = new DataWebRTCManager(callbacks);
const mediaManager = new MediaWebRTCManager(callbacks);
```

**Ahora:**
```typescript
const signalingChannel = createSignalingChannel(userParams, callbacks);
const dataManager = createDataManager(callbacks);
const mediaManager = createMediaManager(callbacks);
```

## Ejemplos de Migración

### Chat de Texto

**Código Anterior:**
```typescript
import { SignalingChannel } from './lib/signaling.js';
import { DataWebRTCManager } from './lib/webrtc-data.js';

const signalingChannel = new SignalingChannel(
  'http://localhost:3000',
  { userId: 'user123', roomId: 'room456' },
  callbacks
);
const dataManager = new DataWebRTCManager(callbacks);
```

**Código Migrado:**
```typescript
import { 
  createSignalingChannel, 
  createDataManager,
  useSocketIO // Opcional: para ser explícito
} from './lib/index.js';

// Opcional: configurar explícitamente Socket.IO
useSocketIO('http://localhost:3000');

const signalingChannel = createSignalingChannel(
  { userId: 'user123', roomId: 'room456' },
  callbacks
);
const dataManager = createDataManager(callbacks);
```

### Video Chat con WebSocket

**Nuevo Código (usando WebSocket):**
```typescript
import { 
  createSignalingChannel, 
  createMediaManager,
  useWebSocket
} from './lib/index.js';

// Configurar WebSocket como transporte
useWebSocket('ws://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 5,
  compression: true
});

const signalingChannel = createSignalingChannel(
  { userId: 'user123', roomId: 'room456' },
  callbacks
);
const mediaManager = createMediaManager(callbacks);
```

## Configuración Avanzada

### Configuración Manual Completa

```typescript
import { configureWebRTCLib } from './lib/index.js';

configureWebRTCLib({
  signaling: {
    transport: 'websocket', // o 'socketio'
    url: 'ws://localhost:3000',
    options: {
      websocket: {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        compression: true
      }
    }
  },
  webrtc: {
    iceServers: {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302'] },
        { 
          urls: ['turn:your-turn-server.com:3478'],
          username: 'user',
          credential: 'pass'
        }
      ]
    },
    enableLogging: true
  }
});
```

### Configuración por Entorno

```typescript
import { useSocketIO, useWebSocket } from './lib/index.js';

// Configuración basada en el entorno
if (process.env.NODE_ENV === 'production') {
  useWebSocket('wss://your-production-server.com');
} else {
  useSocketIO('http://localhost:3000');
}
```

## Compatibilidad

### ✅ Funciona Sin Cambios
- Todas las APIs existentes de WebRTC managers
- Callbacks y eventos
- Métodos de signaling
- Configuración de ICE servers

### ⚠️ Requiere Actualización
- Importaciones de archivos específicos
- Instanciación directa de clases (recomendado usar factories)

### 🆕 Nuevas Funcionalidades
- Configuración centralizada
- Soporte para WebSocket nativo
- Factory functions
- Funciones de conveniencia

## Beneficios de la Migración

1. **Menor Dependencia**: WebSocket nativo elimina la dependencia de Socket.IO
2. **Mejor Rendimiento**: WebSocket nativo es más ligero
3. **Flexibilidad**: Cambiar entre transportes sin modificar código
4. **Mantenibilidad**: Código mejor organizado
5. **Extensibilidad**: Fácil agregar nuevos transportes

## Solución de Problemas

### Error: "Cannot find module"
**Problema**: Las importaciones no funcionan después de la migración.
**Solución**: Actualizar las rutas de importación según la nueva estructura.

### Error: "SignalingChannel is not a constructor"
**Problema**: Intentando usar `new SignalingChannel()` con la nueva API.
**Solución**: Usar `createSignalingChannel()` en su lugar.

### WebSocket no conecta
**Problema**: El servidor no soporta WebSocket nativo.
**Solución**: Usar `useSocketIO()` para mantener Socket.IO como transporte.

## Próximos Pasos

1. Actualizar importaciones
2. Probar con Socket.IO (sin cambios)
3. Experimentar con WebSocket nativo
4. Configurar según necesidades específicas
5. Optimizar para producción

¿Necesitas ayuda con la migración? Consulta la documentación completa en `LIBRARY_DOCUMENTATION.md`.