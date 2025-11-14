<!-- ScreenShare.vue - Componente para compartir pantalla -->
<template>
  <div class="screen-share-container">
    <!-- Controles de Screen Sharing -->
    <div class="controls-section mb-4 p-4 bg-gray-800 rounded-lg">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-white">Compartir Pantalla</h3>
        <div class="flex items-center space-x-2">
          <span 
            class="px-3 py-1 rounded-full text-sm font-medium"
            :class="isSharing ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'"
          >
            {{ isSharing ? 'Compartiendo' : 'Inactivo' }}
          </span>
          <button
            @click="toggleScreenShare"
            class="px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2"
            :class="isSharing ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'"
            :disabled="isToggling"
          >
            <MaterialIcon 
              :icon="isSharing ? 'stop_screen_share' : 'screen_share'" 
              customSize="20px" 
            />
            <span>{{ isSharing ? 'Detener' : 'Compartir' }}</span>
          </button>
        </div>
      </div>

      <!-- Estadísticas de Screen Sharing -->
      <div v-if="isSharing || screenStats.trackCount > 0" class="stats-grid grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div class="stat-item bg-gray-700 p-3 rounded">
          <span class="text-gray-400 block text-xs">Video</span>
          <span class="text-white font-medium">{{ screenStats.hasVideo ? 'Activo' : 'Inactivo' }}</span>
        </div>
        <div class="stat-item bg-gray-700 p-3 rounded">
          <span class="text-gray-400 block text-xs">Audio</span>
          <span class="text-white font-medium">{{ screenStats.hasAudio ? 'Activo' : 'Inactivo' }}</span>
        </div>
        <div class="stat-item bg-gray-700 p-3 rounded">
          <span class="text-gray-400 block text-xs">Tracks</span>
          <span class="text-white font-medium">{{ screenStats.trackCount }}</span>
        </div>
        <div class="stat-item bg-gray-700 p-3 rounded" v-if="screenStats.resolution">
          <span class="text-gray-400 block text-xs">Resolución</span>
          <span class="text-white font-medium">
            {{ screenStats.resolution.width }}×{{ screenStats.resolution.height }}
          </span>
        </div>
      </div>

      <!-- Mensaje de error si hay -->
      <div v-if="errorMessage" class="error-message mt-4 p-3 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm">
        <div class="flex items-center space-x-2">
          <MaterialIcon icon="error" customSize="16px" />
          <span>{{ errorMessage }}</span>
        </div>
      </div>
    </div>

    <!-- Video local de screen sharing -->
    <div v-if="localScreenStream" class="local-screen-section mb-4">
      <h4 class="text-md font-medium text-white mb-2">Tu pantalla compartida:</h4>
      <div class="relative bg-black rounded-lg overflow-hidden shadow-lg">
        <video
          ref="localScreenVideo"
          class="w-full h-auto max-h-96 object-contain"
          autoplay
          playsinline
          muted
          :srcObject="localScreenStream"
        ></video>
        <div class="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
          📺 Tu pantalla
        </div>
      </div>
    </div>

    <!-- Videos remotos de screen sharing -->
    <div v-if="remoteScreenStreams.length > 0" class="remote-screens-section">
      <h4 class="text-md font-medium text-white mb-2">Pantallas compartidas por otros:</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div 
          v-for="(screenShare, index) in remoteScreenStreams" 
          :key="screenShare.peerId"
          class="relative bg-black rounded-lg overflow-hidden shadow-lg"
        >
          <video
            :ref="el => setRemoteScreenRef(el as HTMLVideoElement, screenShare.stream)"
            class="w-full h-auto max-h-64 object-contain"
            autoplay
            playsinline
          ></video>
          <div class="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-2">
            <div class="flex items-center justify-between text-white text-sm">
              <span>{{ screenShare.peerId }}</span>
              <div class="flex items-center space-x-1">
                <span v-if="screenShare.hasVideo" class="text-green-400">📺</span>
                <span v-if="screenShare.hasAudio" class="text-blue-400">🔊</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mensaje cuando no hay streams activos -->
    <div 
      v-if="!isSharing && remoteScreenStreams.length === 0" 
      class="empty-state text-center py-8 text-gray-400"
    >
      <MaterialIcon icon="desktop_windows" customSize="48px" class="mb-4 opacity-50" />
      <p class="text-lg mb-2">No hay screen sharing activo</p>
      <p class="text-sm">Haz clic en "Compartir" para comenzar a compartir tu pantalla</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ScreenWebRTCManager, type ScreenWebRTCCallbacks, createScreenManager } from '../lib/webrtc/index';
import MaterialIcon from './MaterialIcon.vue';
import apiConfig from '../lib/apiConfig';

// Props
interface Props {
  userId: string;
  roomId: string;
}

const props = defineProps<Props>();

// Estado reactivo
const isSharing = ref(false);
const isToggling = ref(false);
const errorMessage = ref('');
const localScreenStream = ref<MediaStream | null>(null);
const remoteScreenStreams = ref<Array<{
  peerId: string;
  stream: MediaStream;
  hasVideo: boolean;
  hasAudio: boolean;
}>>([]);

// Referencias a elementos DOM
const localScreenVideo = ref<HTMLVideoElement | null>(null);
const remoteScreenRefs = ref<Map<string, HTMLVideoElement>>(new Map());

// Instancias no reactivas
let screenWebRTC: ScreenWebRTCManager;
let signalingChannel: any;

// Estadísticas computadas
const screenStats = computed(() => {
  if (!screenWebRTC) {
    return {
      isSharing: false,
      hasVideo: false,
      hasAudio: false,
      trackCount: 0,
      resolution: undefined
    };
  }
  return screenWebRTC.getScreenShareStats();
});

// --- Funciones del ciclo de vida ---
onMounted(() => {
  initializeScreenManager();
  initializeSignaling();
});

onUnmounted(() => {
  cleanup();
});

// --- Funciones de inicialización ---
function initializeScreenManager() {
  screenWebRTC = createScreenManager({
    onSignalNeeded: (peerId, signal) => {
      console.log(`[ScreenShare] Señal para ${peerId}:`, signal);
      signalingChannel.sendSignal(peerId, signal);
    },
    
    onScreenShareStarted: (peerId, stream) => {
      console.log(`[ScreenShare] Screen sharing iniciado por ${peerId}`);
      
      if (peerId === 'screen') {
        // Es nuestro propio stream
        localScreenStream.value = stream;
      } else {
        // Es un stream remoto
        addRemoteScreenStream(peerId, stream);
      }
    },
    
    onScreenShareStopped: (peerId) => {
      console.log(`[ScreenShare] Screen sharing detenido por ${peerId}`);
      
      if (peerId === 'screen') {
        // Es nuestro propio stream
        localScreenStream.value = null;
        isSharing.value = false;
      } else {
        // Es un stream remoto
        removeRemoteScreenStream(peerId);
      }
    },
    
    onConnectionStateChange: (peerId, state) => {
      console.log(`[ScreenShare] Estado con ${peerId}: ${state}`);
    },
    
    onDataChannelMessage: (peerId, message) => {
      console.log(`[ScreenShare] Mensaje de ${peerId}:`, message);
      handleDataChannelMessage(peerId, message);
    }
  });
}

function initializeSignaling() {
  // Aquí deberías inicializar tu canal de señalización
  // Por ahora, usaremos una implementación básica
  signalingChannel = {
    sendSignal: (peerId: string, signal: any) => {
      console.log(`[ScreenShare] Enviando señal a ${peerId}:`, signal);
      // Implementa el envío real según tu infraestructura
    }
  };
}

// --- Funciones de manejo de streams ---
function addRemoteScreenStream(peerId: string, stream: MediaStream) {
  const videoTracks = stream.getVideoTracks();
  const audioTracks = stream.getAudioTracks();
  
  remoteScreenStreams.value.push({
    peerId,
    stream,
    hasVideo: videoTracks.length > 0,
    hasAudio: audioTracks.length > 0
  });
}

function removeRemoteScreenStream(peerId: string) {
  const index = remoteScreenStreams.value.findIndex(s => s.peerId === peerId);
  if (index !== -1) {
    remoteScreenStreams.value.splice(index, 1);
  }
}

// --- Funciones de control ---
async function toggleScreenShare() {
  if (isToggling.value) return;
  
  isToggling.value = true;
  errorMessage.value = '';
  
  try {
    if (isSharing.value) {
      // Detener screen sharing
      screenWebRTC.stopScreenShare();
      console.log('[ScreenShare] Screen sharing detenido manualmente');
    } else {
      // Iniciar screen sharing
      const stream = await screenWebRTC.startScreenShare();
      if (stream) {
        isSharing.value = true;
        localScreenStream.value = stream;
        console.log('[ScreenShare] Screen sharing iniciado exitosamente');
      } else {
        errorMessage.value = 'No se pudo iniciar el screen sharing. Verifica los permisos.';
      }
    }
  } catch (error) {
    console.error('[ScreenShare] Error al toggle screen share:', error);
    errorMessage.value = `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`;
  } finally {
    isToggling.value = false;
  }
}

// --- Funciones de utilidad ---
function setRemoteScreenRef(el: HTMLVideoElement | null, stream: MediaStream) {
  if (el && stream) {
    el.srcObject = stream;
  }
}

function handleDataChannelMessage(peerId: string, message: string) {
  try {
    const data = JSON.parse(message);
    if (data.type === 'screen-metadata') {
      console.log(`[ScreenShare] Metadatos de ${peerId}:`, data);
    }
  } catch (error) {
    console.warn('[ScreenShare] Error parsing data channel message:', error);
  }
}

function cleanup() {
  if (screenWebRTC) {
    screenWebRTC.stopScreenShare();
    screenWebRTC.closeAllConnections();
  }
  
  if (localScreenStream.value) {
    localScreenStream.value.getTracks().forEach(track => track.stop());
  }
  
  remoteScreenStreams.value = [];
  remoteScreenRefs.value.clear();
}
</script>

<style scoped>
.screen-share-container {
  max-width: 1200px;
  margin: 0 auto;
}

.controls-section {
  backdrop-filter: blur(8px);
  background: rgba(31, 41, 55, 0.8);
}

.stat-item {
  transition: all 0.2s ease;
}

.stat-item:hover {
  background: rgba(55, 65, 81, 0.8);
}

.local-screen-section video,
.remote-screens-section video {
  border: 2px solid transparent;
  transition: border-color 0.3s ease;
}

.local-screen-section video:hover,
.remote-screens-section video:hover {
  border-color: #3b82f6;
}

.error-message {
  animation: slideIn 0.3s ease-out;
}

.empty-state {
  animation: fadeIn 0.5s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .controls-section {
    padding: 1rem;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
