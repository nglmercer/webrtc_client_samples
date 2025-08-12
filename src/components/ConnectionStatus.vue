<template>
  <div class="connection-status">
    <div 
      :class="[
        'status-indicator flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        isConnected ? 'bg-green-500/20 text-green-300 border border-green-500/50' : 'bg-red-500/20 text-red-300 border border-red-500/50'
      ]"
    >
      <div 
        :class="[
          'w-2 h-2 rounded-full mr-2 transition-all duration-200',
          isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
        ]"
      ></div>
      <span>{{ statusText }}</span>
      
      <button 
        v-if="!isConnected"
        @click="reconnect"
        :disabled="isReconnecting"
        class="ml-3 px-2 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white text-xs rounded transition-colors duration-200"
      >
        {{ isReconnecting ? 'Reconectando...' : 'Reconectar' }}
      </button>
    </div>
    
    <!-- Información adicional cuando está conectado -->
    <div v-if="isConnected && roomCount !== null" class="mt-2 text-xs text-white/60">
      {{ roomCount }} {{ roomCount === 1 ? 'sala disponible' : 'salas disponibles' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { emitter } from '../lib/Emitter';
import { emitToSocket } from '../lib/socket';
import type { RoomListItem } from '../lib/types/room';

// Reactive state
const isConnected = ref(false);
const isReconnecting = ref(false);
const roomCount = ref<number | null>(null);

// Computed properties
const statusText = computed(() => {
  if (isReconnecting.value) {
    return 'Reconectando...';
  }
  return isConnected.value ? 'Conectado' : 'Desconectado';
});

// Methods
const reconnect = async () => {
  if (isReconnecting.value) return;
  
  isReconnecting.value = true;
  
  try {
    // Emitir evento para solicitar reconexión
    emitter.emit('requestReconnect');
    
    // Simular tiempo de reconexión
    setTimeout(() => {
      isReconnecting.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error al reconectar:', error);
    isReconnecting.value = false;
  }
};

// Event handlers
const handleConnectionStatus = (connected: boolean) => {
  isConnected.value = connected;
  if (connected) {
    isReconnecting.value = false;
  }
};

const handleRoomsUpdate = (rooms: RoomListItem[]) => {
  roomCount.value = rooms.length;
};

const handleRoomsError = (error: string) => {
  console.error('Error en salas:', error);
  // Podrías mostrar una notificación aquí
};

// Lifecycle
onMounted(() => {
  // Suscribirse a eventos del emitter
  emitter.on('connectionStatus', handleConnectionStatus);
  emitter.on('rooms', handleRoomsUpdate);
  emitter.on('roomsError', handleRoomsError);
});

onUnmounted(() => {
  // Desuscribirse de eventos del emitter
  emitter.off('connectionStatus', handleConnectionStatus);
  emitter.off('rooms', handleRoomsUpdate);
  emitter.off('roomsError', handleRoomsError);
});
</script>

<style scoped>

</style>