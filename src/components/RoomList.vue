<template>
  <div class="room-list">
    <div class="room-list-header">
      <h3 class="text-xl font-semibold text-white mb-4">
        Salas Disponibles
      </h3>
      <button 
        @click="refreshRooms" 
        :disabled="isLoading"
        class="refresh-btn bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50"
      >
        <MaterialIcon icon="refresh" size="text-sm" customSize="16px" />
        <span class="ml-1">Actualizar</span>
      </button>
    </div>

    <div v-if="isLoading" class="loading-state">
      <div class="flex items-center justify-center py-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <span class="ml-3 text-white">Cargando salas...</span>
      </div>
    </div>

    <div v-else-if="error" class="error-state">
      <div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
        <MaterialIcon icon="error" size="text-lg" customSize="20px" />
        <span class="ml-2">{{ error }}</span>
      </div>
    </div>

    <div v-else-if="roomList.length === 0" class="empty-state">
      <div class="text-center py-8 text-white/60">
        <MaterialIcon icon="meeting_room" size="text-4xl" customSize="48px" />
        <p class="mt-2">No hay salas disponibles</p>
        <p class="text-sm">Crea una nueva sala para comenzar</p>
      </div>
    </div>

    <div v-else class="rooms-grid">
      <div 
        v-for="room in roomList" 
        :key="room.name"
        class="room-card bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-4 hover:bg-white/15 transition-all duration-200"
      >
        <div class="room-header flex items-center justify-between mb-3">
          <h4 class="font-semibold text-white truncate">{{ room.name }}</h4>
          <span 
            :class="[
              'px-2 py-1 rounded-full text-xs font-medium',
              room.canJoin ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
            ]"
          >
            {{ room.canJoin ? 'Disponible' : 'Llena' }}
          </span>
        </div>

        <div class="room-info space-y-2 text-sm text-white/70">
          <div class="flex items-center">
            <MaterialIcon icon="person" size="text-sm" customSize="14px" />
            <span class="ml-1">Creador: {{ room.owner }}</span>
          </div>
          
          <div class="flex items-center">
            <MaterialIcon icon="group" size="text-sm" customSize="14px" />
            <span class="ml-1">
              {{ room.participantCount }}/{{ room.maxParticipants }} participantes
            </span>
          </div>
          
          <div class="flex items-center">
            <MaterialIcon icon="schedule" size="text-sm" customSize="14px" />
            <span class="ml-1">Creada: {{ formatDate(room.createdAt) }}</span>
          </div>
        </div>

        <div class="room-actions mt-4">
          <button 
            @click="joinRoom(room.name)"
            :disabled="!room.canJoin"
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded-lg transition-colors duration-200"
          >
            <MaterialIcon icon="login" size="text-sm" customSize="16px" />
            <span class="ml-1">{{ room.canJoin ? 'Unirse' : 'Sala Llena' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { emitter } from '../lib/Emitter';
import { ref, onMounted, onUnmounted } from 'vue';
import type { RoomListItem } from '../lib/types/room';
import MaterialIcon from './MaterialIcon.vue';

// Props
interface Props {
  userId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  userId: 'user'
});

// Emits
const emit = defineEmits<{
  roomSelected: [roomName: string];
}>();

// Reactive state
const roomList = ref<RoomListItem[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Methods
const refreshRooms = () => {
  isLoading.value = true;
  error.value = null;
  
  // Emitir evento para solicitar actualización de salas
  emitter.emit('requestRooms');
};

const joinRoom = (roomName: string) => {
  // Emitir evento Vue
  emit('roomSelected', roomName);
  
  // También emitir evento DOM para compatibilidad con Astro
  const event = new CustomEvent('roomSelected', {
    detail: { roomName },
    bubbles: true
  });
  document.dispatchEvent(event);
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Fecha inválida';
  }
};

// Event handlers para el emitter
const handleRoomsUpdate = (rooms: RoomListItem[]) => {
  roomList.value = rooms;
  isLoading.value = false;
  error.value = null;
};

const handleRoomsError = (errorMessage: string) => {
  error.value = errorMessage;
  isLoading.value = false;
};

const handleConnectionStatus = (connected: boolean) => {
  if (!connected) {
    error.value = 'Conexión perdida con el servidor';
  } else {
    error.value = null;
    // Solicitar salas cuando se reconecte
    refreshRooms();
  }
};

// Lifecycle
onMounted(() => {
  // Suscribirse a eventos del emitter
  emitter.on('rooms', handleRoomsUpdate);
  emitter.on('roomsError', handleRoomsError);
  emitter.on('connectionStatus', handleConnectionStatus);
  
  // Solicitar salas iniciales
  refreshRooms();
});

onUnmounted(() => {
  // Desuscribirse de eventos del emitter
  emitter.off('rooms', handleRoomsUpdate);
  emitter.off('roomsError', handleRoomsError);
  emitter.off('connectionStatus', handleConnectionStatus);
});
</script>

