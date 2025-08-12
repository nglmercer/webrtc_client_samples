# Sistema de Emitter - Guía de Uso

Este documento explica cómo utilizar el sistema de emitter centralizado para la comunicación entre componentes y el WebSocket.

## Arquitectura

El sistema está compuesto por:

- **`src/lib/Emitter.ts`**: Clase de eventos personalizada
- **`src/lib/socket.ts`**: Conexión WebSocket centralizada con emitter
- **Componentes Vue**: Que se suscriben a eventos del emitter

## Eventos Disponibles

### Eventos Emitidos por el Sistema

| Evento | Datos | Descripción |
|--------|-------|-------------|
| `connectionStatus` | `boolean` | Estado de conexión del WebSocket |
| `rooms` | `RoomListItem[]` | Lista actualizada de salas disponibles |
| `roomsError` | `string` | Error al obtener o procesar salas |

### Eventos que Puedes Emitir

| Evento | Datos | Descripción |
|--------|-------|-------------|
| `requestRooms` | - | Solicita actualización de la lista de salas |
| `requestReconnect` | - | Solicita reconexión al WebSocket |

## Uso en Componentes Vue

### Ejemplo Básico

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { emitter } from '../lib/Emitter';
import type { RoomListItem } from '../lib/types/room';

const rooms = ref<RoomListItem[]>([]);
const isConnected = ref(false);

// Handlers de eventos
const handleRoomsUpdate = (roomList: RoomListItem[]) => {
  rooms.value = roomList;
};

const handleConnectionStatus = (connected: boolean) => {
  isConnected.value = connected;
};

// Solicitar datos
const refreshRooms = () => {
  emitter.emit('requestRooms');
};

// Lifecycle
onMounted(() => {
  emitter.on('rooms', handleRoomsUpdate);
  emitter.on('connectionStatus', handleConnectionStatus);
  
  // Solicitar datos iniciales
  refreshRooms();
});

onUnmounted(() => {
  emitter.off('rooms', handleRoomsUpdate);
  emitter.off('connectionStatus', handleConnectionStatus);
});
</script>
```

### Ejemplo Avanzado con Manejo de Errores

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { emitter } from '../lib/Emitter';
import { emitToSocket } from '../lib/socket';

const error = ref<string | null>(null);
const isLoading = ref(false);

// Handler para errores
const handleError = (errorMessage: string) => {
  error.value = errorMessage;
  isLoading.value = false;
};

// Función para enviar datos personalizados al socket
const sendCustomData = (data: any) => {
  const success = emitToSocket('customEvent', data, (response) => {
    console.log('Respuesta del servidor:', response);
  });
  
  if (!success) {
    error.value = 'No hay conexión disponible';
  }
};

onMounted(() => {
  emitter.on('roomsError', handleError);
});

onUnmounted(() => {
  emitter.off('roomsError', handleError);
});
</script>
```

## Funciones Exportadas del Socket

### `emitToSocket(event, data?, callback?)`

Emite un evento personalizado al WebSocket.

```typescript
import { emitToSocket } from '../lib/socket';

// Enviar evento simple
emitToSocket('myEvent', { data: 'test' });

// Enviar evento con callback
emitToSocket('myEvent', { data: 'test' }, (response) => {
  console.log('Respuesta:', response);
});
```

### `onSocketEvent(event, handler)` y `offSocketEvent(event, handler?)`

Suscribirse y desuscribirse de eventos del WebSocket directamente.

```typescript
import { onSocketEvent, offSocketEvent } from '../lib/socket';

const handler = (data) => {
  console.log('Evento recibido:', data);
};

// Suscribirse
onSocketEvent('customServerEvent', handler);

// Desuscribirse
offSocketEvent('customServerEvent', handler);
```

## Componentes de Ejemplo

### RoomList.vue
Muestra cómo listar salas usando el emitter.

### ConnectionStatus.vue
Muestra el estado de conexión y permite reconectar.

## Mejores Prácticas

1. **Siempre desuscribirse**: Usa `onUnmounted` para limpiar listeners
2. **Manejo de errores**: Suscríbete a eventos de error
3. **Estados de carga**: Usa estados reactivos para mostrar feedback al usuario
4. **Reutilización**: El emitter permite que múltiples componentes accedan a los mismos datos
5. **Centralización**: Evita crear múltiples conexiones WebSocket

## Extensión del Sistema

Para agregar nuevos eventos:

1. **En socket.ts**: Agrega el listener del WebSocket y emite al emitter
2. **En componentes**: Suscríbete al nuevo evento
3. **Actualiza tipos**: Si es necesario, actualiza las interfaces TypeScript

```typescript
// En socket.ts
io.on('newServerEvent', (data) => {
  emitter.emit('newClientEvent', data);
});

// En componente
emitter.on('newClientEvent', (data) => {
  // Manejar datos
});
```