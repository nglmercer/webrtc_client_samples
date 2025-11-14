<!-- ScreenChatDemo.vue - Demo completo de Video Chat con Screen Sharing -->
<template>
  <div class="flex flex-col h-screen font-sans text-white bg-gray-900">
    <!-- Encabezado -->
    <header class="p-4 border-b border-gray-700 text-center">
      <h1 class="text-2xl font-bold">Video Chat con Screen Sharing</h1>
      <p class="text-sm text-gray-400">
        Tu ID: {{ state.myId }} | Sala: {{ state.roomId }} | Estado: {{ state.status }}
      </p>
    </header>

    <!-- Contenido principal con pestañas -->
    <main class="flex-grow p-4 bg-gray-800/50">
      <!-- Navegación de pestañas -->
      <div class="tabs-navigation mb-4 flex space-x-2 border-b border-gray-600">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-2 font-medium transition-colors duration-200 border-b-2"
          :class="activeTab === tab.id ? 
            'text-blue-400 border-blue-400' : 
            'text-gray-400 border-transparent hover:text-gray-300'"
        >
          <MaterialIcon :icon="tab.icon" customSize="18px" class="mr-2" />
          {{ tab.label }}
        </button>
      </div>

      <!-- Contenido de pestañas -->
      <div class="tab-content">
        <!-- Pestaña de Video Chat -->
        <div v-if="activeTab === 'video'" class="video-chat-tab">
          <UnifiedVideoGrid 
            :videos="videoList" 
            :config="gridConfig"
            ref="videoGrid"
          >
            <template #video="{ video, isActive, isFocused, isMain }">
              <div class="relative bg-black rounded-lg overflow-hidden shadow-lg h-full">
                <!-- Video Local -->
                <video 
                  v-if="video.id === state.myId && state.localStream"
                  ref="localVideo" 
                  class="w-full h-full object-cover" 
                  autoplay 
                  playsinline 
                  muted
                  :srcObject="state.localStream"
                ></video>
                
                <!-- Videos Remotos -->
                <video 
                  v-else-if="video.id !== state.myId && state.peers[video.id]?.stream"
                  :ref="el => setVideoRef(el as HTMLVideoElement, state.peers[video.id].stream!)"
                  class="w-full h-full object-cover" 
                  autoplay 
                  playsinline
                ></video>
                
                <!-- Estado de conexión -->
                <div 
                  v-else-if="video.id !== state.myId && !state.peers[video.id]?.stream" 
                  class="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-800"
                >
                  <div class="text-center">
                    <div class="animate-pulse mb-2">🔄</div>
                    <p>Conectando con {{ video.id }}...</p>
                  </div>
                </div>
                
                <!-- Placeholder para video local sin stream -->
                <div 
                  v-else-if="video.id === state.myId && !state.localStream" 
                  class="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-800"
                >
                  <div class="text-center">
                    <div class="mb-2">📹</div>
                    <p>Cámara desactivada</p>
                  </div>
                </div>

                <!-- Etiqueta con información -->
                <div class="absolute bottom-0 left-0 bg-black/70 px-3 py-2 text-sm rounded-tr-lg">
                  <div class="flex items-center space-x-2">
                    <span class="font-medium">
                      {{ video.id === state.myId ? `${video.id} (Tú)` : video.id }}
                    </span>
                    <div class="flex space-x-1">
                      <span v-if="video.id === state.myId && !state.isMicEnabled" class="text-red-400">🔇</span>
                      <span v-if="video.id === state.myId && !state.isCamEnabled" class="text-red-400">📹</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </UnifiedVideoGrid>
        </div>

        <!-- Pestaña de Screen Sharing -->
        <div v-if="activeTab === 'screen'" class="screen-share-tab">
          <ScreenShare 
            :userId="state.myId"
            :roomId="state.roomId"
          />
        </div>

        <!-- Pestaña de Participantes -->
        <div v-if="activeTab === 'participants'" class="participants-tab">
          <div class="bg-gray-800 rounded-lg p-6">
            <h3 class="text-lg font-semibold mb-4">Participantes en la sala</h3>
            <div class="space-y-3">
              <div 
                v-for="participant in participantsList" 
                :key="participant.id"
                class="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
              >
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-medium">
                    {{ participant.id.substring(0, 2).toUpperCase() }}
                  </div>
                  <div>
                    <div class="font-medium">{{ participant.id }}</div>
                    <div class="text-sm text-gray-400">{{ participant.status }}</div>
                  </div>
                </div>
                <div class="flex items-center space-x-2 text-sm">
                  <span v-if="participant.hasVideo" class="text-green-400">📹</span>
                  <span v-if="participant.hasAudio" class="text-blue-400">🔊</span>
                  <span v-if="participant.hasScreen" class="text-purple-400">🖥️</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Controles unificados -->
    <footer class="p-4 border-t border-gray-700">
      <div class="flex justify-center items-center space-x-4">
        <!-- Controles de audio/video -->
        <button 
          @click="handleToggleMic" 
          class="flex items-center justify-center w-14 h-14 rounded-full text-white font-bold transition-colors duration-200" 
          :class="state.isMicEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'"
        >
          <MaterialIcon 
            :icon="state.isMicEnabled ? 'mic' : 'mic_off'" 
            customSize="24px" 
          />
        </button>
        <button 
          @click="handleToggleCam" 
          class="flex items-center justify-center w-14 h-14 rounded-full text-white font-bold transition-colors duration-200" 
          :class="state.isCamEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'"
        >
          <MaterialIcon 
            :icon="state.isCamEnabled ? 'videocam' : 'videocam_off'" 
            customSize="24px" 
          />
        </button>
        
        <!-- Separador -->
        <div class="w-px h-8 bg-gray-600"></div>
        
        <!-- Controles adicionales -->
        <button 
          @click="toggleChat"
          class="flex items-center justify-center w-14 h-14 rounded-full bg-gray-600 hover:bg-gray-700 text-white font-bold transition-colors duration-200"
        >
          <MaterialIcon icon="chat" customSize="24px" />
        </button>
        <button 
          @click="toggleSettings"
          class="flex items-center justify-center w-14 h-14 rounded-full bg-gray-600 hover:bg-gray-700 text-white font-bold transition-colors duration-200"
        >
          <MaterialIcon icon="settings" customSize="24px" />
        </button>
      </div>
    </footer>

    <!-- Chat flotante (opcional) -->
    <div 
      v-if="showChat"
      class="fixed bottom-20 right-4 w-80 h-96 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50"
    >
      <div class="flex items-center justify-between p-3 border-b border-gray-600">
        <h4 class="font-medium">Chat</h4>
        <button @click="showChat = false" class="text-gray-400 hover:text-white">
          <MaterialIcon icon="close" customSize="20px" />
        </button>
      </div>
      <div class="p-4 h-80 overflow-y-auto">
        <p class="text-gray-400 text-center">Función de chat próximamente...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useStore } from '@nanostores/vue';
import { mediaChatStore, setPeerState, removePeer } from '../lib/media-store';
import { 
  SignalingChannel, 
  createSignalingChannel, 
  MediaWebRTCManager, 
  type MediaWebRTCCallbacks, 
  createMediaManager 
} from '../lib/webrtc/index';
import MaterialIcon from './MaterialIcon.vue';
import UnifiedVideoGrid from './UnifiedVideoGrid.vue';
import ScreenShare from './ScreenShare.vue';
import apiConfig from '../lib/apiConfig';
import { flexboxConfig } from '../lib/gridConfigs';

// --- 1. INICIALIZACIÓN Y ESTADO ---
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId') || `user_${Math.random().toString(36).substring(2, 5)}`;
const roomId = params.get('roomId') || 'screen-demo-room';

// Estado del store
const state = useStore(mediaChatStore);
const localVideo = ref<HTMLVideoElement | null>(null);
const videoGrid = ref<InstanceType<typeof UnifiedVideoGrid> | null>(null);

// Estado local del componente
const activeTab = ref('video');
const showChat = ref(false);
const showSettings = ref(false);

// Instancias no reactivas
let webrtc: MediaWebRTCManager;
let signaling: SignalingChannel;

// Configuración
const gridConfig = flexboxConfig;

// Pestañas disponibles
const tabs = [
  { id: 'video', label: 'Video Chat', icon: 'videocam' },
  { id: 'screen', label: 'Screen Sharing', icon: 'screen_share' },
  { id: 'participants', label: 'Participantes', icon: 'people' }
];

// Lista de videos para el grid
const videoList = computed(() => {
  const videos = [state.value.myId];
  
  Object.keys(state.value.peers).forEach(peerId => {
    if (!videos.includes(peerId)) {
      videos.push(peerId);
    }
  });
  
  return videos;
});

// Lista de participantes con información extendida
const participantsList = computed(() => {
  const participants = [
    {
      id: state.value.myId,
      status: 'Conectado',
      hasVideo: state.value.isCamEnabled,
      hasAudio: state.value.isMicEnabled,
      hasScreen: false // TODO: Detectar si está compartiendo pantalla
    }
  ];
  
  Object.entries(state.value.peers).forEach(([peerId, peer]) => {
    participants.push({
      id: peerId,
      status: peer.status || 'Conectado',
      hasVideo: !!peer.stream?.getVideoTracks().length,
      hasAudio: !!peer.stream?.getAudioTracks().length,
      hasScreen: false // TODO: Detectar screen sharing remoto
    });
  });
  
  return participants;
});

// --- 2. LÓGICA DEL CICLO DE VIDA ---
onMounted(async () => {
  // Inicializar estado
  mediaChatStore.set({
    myId: userId,
    roomId: roomId,
    status: 'Inicializando...',
    isMicEnabled: false,
    isCamEnabled: false,
    isConnected: false,
    isInitiator: false,
    localStream: null,
    peers: {},
  });

  initializeWebRTCManager();
  initializeSignalingChannel();
  signaling.connect();
  
  watch(
    () => state.value.localStream,
    async (newStream) => {
      await nextTick();
      if (localVideo.value && newStream) {
        localVideo.value.srcObject = newStream;
      }
    },
    { immediate: true }
  );
});

onUnmounted(() => {
  console.log('[ScreenChatDemo] Desmontando componente...');
  if (webrtc) {
    webrtc.closeAllConnections();
  }
  if (signaling) {
    signaling.disconnect();
  }
  state.value.localStream?.getTracks().forEach(track => track.stop());
});

// --- 3. FUNCIONES DE INICIALIZACIÓN ---
function initializeWebRTCManager() {
  webrtc = createMediaManager({
    onSignalNeeded: (peerId, signal) => {
      console.log(`[WebRTC] Enviando señal a ${peerId}`);
      signaling.sendSignal(peerId, signal);
    },
    onRemoteStreamAdded: (peerId, stream) => {
      console.log(`[WebRTC] Stream recibido de ${peerId}`);
      setPeerState(peerId, { stream });
    },
    onConnectionStateChange: (peerId, status) => {
      console.log(`[WebRTC] Estado con ${peerId}: ${status}`);
      setPeerState(peerId, { status });
    }
  });

  if (state.value.localStream) {
    webrtc.setLocalStream(state.value.localStream);
  }
}

function initializeSignalingChannel() {
  const signalingUrl = apiConfig.getFullUrl();
  
  signaling = createSignalingChannel({ userId, roomId }, {
    onConnect: () => {
      mediaChatStore.setKey('status', 'Conectado. Uniéndose a la sala...');
      signaling.checkPresence(isRoomExist => {
        mediaChatStore.setKey('isInitiator', !isRoomExist);
        signaling.openOrJoinRoom(!isRoomExist, (response) => {
          mediaChatStore.setKey('isConnected', true);
          mediaChatStore.setKey('status', `Conectado a la sala ${roomId}`);
          console.log(`[Signaling] ${isRoomExist ? 'Unido' : 'Abierto'} a la sala`);
          
          if (isRoomExist) {
            signaling.sendNewParticipationRequest(roomId);
          }
        });
      });
    },

    onDisconnect: () => {
      mediaChatStore.setKey('status', 'Desconectado');
      mediaChatStore.setKey('isConnected', false);
    },
    
    onMessage: async ({message, sender}: {message: any, sender: any}) => {
      console.log(`[Signaling] Mensaje de ${sender}:`, message);
      
      if (!sender) return;

      if (message.newParticipationRequest) {
        console.log(`[Signaling] ${sender} solicita unirse`);
        setPeerState(sender, {});
        await webrtc.createOffer(sender);
      } 
      else if (message.isWebRTCSignal) {
        const signal = message.signal;
        
        if (signal.type === 'offer') {
          console.log(`[Signaling] Oferta de ${sender}`);
          setPeerState(sender, {});
          await webrtc.handleOffer(sender, signal);
        } 
        else if (signal.type === 'answer') {
          console.log(`[Signaling] Respuesta de ${sender}`);
          await webrtc.handleAnswer(sender, signal);
        }
        else if (signal.candidate) {
          console.log(`[Signaling] Candidato de ${sender}`);
          await webrtc.addIceCandidate(sender, signal.candidate);
        }
      }
    },
    
    onUserDisconnected: (disconnectedUserId: string) => {
      console.log(`[Signaling] ${disconnectedUserId} se desconectó`);
      webrtc.closeConnection(disconnectedUserId);
      removePeer(disconnectedUserId);
    },
    
    onRoomOwnerChanged: (newOwnerId: string) => {
      console.log(`[Signaling] Nuevo dueño de sala: ${newOwnerId}`);
    }
  } as any);
}

// --- 4. MANEJADORES DE UI ---
async function getLocalMedia(constraints: MediaStreamConstraints) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    console.error("Error al obtener media:", error);
    mediaChatStore.setKey('status', 'Error de media. Revisa permisos.');
    return null;
  }
}

async function handleToggleMic() {
  const newState = !state.value.isMicEnabled;
  mediaChatStore.setKey('isMicEnabled', newState);
  
  if (newState) {
    const audioStream = await getLocalMedia({ audio: true });
    if (audioStream) {
      const audioTrack = audioStream.getAudioTracks()[0];
      if (!state.value.localStream) {
        mediaChatStore.setKey('localStream', new MediaStream([audioTrack]));
      } else {
        state.value.localStream.addTrack(audioTrack);
      }
      await webrtc.addMediaTrack(audioTrack);
      webrtc.toggleMic(true);
    } else {
      mediaChatStore.setKey('isMicEnabled', false);
    }
  } else {
    webrtc.toggleMic(false);
  }
}

async function handleToggleCam() {
  const newState = !state.value.isCamEnabled;
  mediaChatStore.setKey('isCamEnabled', newState);
  
  if (newState) {
    const videoStream = await getLocalMedia({ video: true });
    if (videoStream) {
      const videoTrack = videoStream.getVideoTracks()[0];
      if (!state.value.localStream) {
        mediaChatStore.setKey('localStream', new MediaStream([videoTrack]));
      } else {
        state.value.localStream.addTrack(videoTrack);
      }
      await webrtc.addMediaTrack(videoTrack);
      webrtc.toggleCam(true);
    } else {
      mediaChatStore.setKey('isCamEnabled', false);
    }
  } else {
    webrtc.toggleCam(false);
  }
}

function toggleChat() {
  showChat.value = !showChat.value;
}

function toggleSettings() {
  showSettings.value = !showSettings.value;
  // TODO: Implementar modal de configuración
}

function setVideoRef(el: HTMLVideoElement | null, stream: MediaStream) {
  if (el) {
    el.srcObject = stream;
  }
}
</script>

<style scoped>
.tabs-navigation {
  scrollbar-width: thin;
  scrollbar-color: #4b5563 #1f2937;
}

.tab-content {
  min-height: 500px;
}

.video-chat-tab,
.screen-share-tab,
.participants-tab {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Transiciones suaves */
.hover-scale {
  transition: transform 0.2s ease;
}

.hover-scale:hover {
  transform: scale(1.05);
}

/* Estilos específicos para participantes */
.participants-tab {
  max-height: 500px;
  overflow-y: auto;
}

/* Chat flotante */
.fixed {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

/* Responsive */
@media (max-width: 768px) {
  .tabs-navigation {
    overflow-x: auto;
    white-space: nowrap;
  }
  
  .fixed {
    width: calc(100vw - 2rem);
    right: 1rem;
    left: 1rem;
    height: 60vh;
  }
}
</style>
