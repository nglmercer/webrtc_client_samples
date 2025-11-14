<!-- ScreenShareVideo.vue - Componente de screen sharing basado en VideoChat -->
<template>
  <div class="flex flex-col h-screen mx-auto p-4 font-sans text-white bg-gray-900">
    <!-- Encabezado -->
    <header class="p-4 border-b border-gray-700 text-center">
      <h1 class="text-2xl font-bold">Screen Sharing: {{ state.roomId }}</h1>
      <p class="text-sm text-gray-400">Tu ID: {{ state.myId }} | Estado: {{ state.status }}</p>
    </header>

    <!-- Área de Videos usando UnifiedVideoGrid -->
    <main class="flex-grow p-4 my-4 bg-gray-800/50 rounded-lg overflow-y-auto">
      <UnifiedVideoGrid 
        :videos="videoList" 
        :config="gridConfig"
        ref="videoGrid"
      >
        <template #video="{ video, index, config, isActive, isFocused, isMain }">
          <div class="relative bg-black rounded-lg overflow-hidden shadow-lg h-full">
            <!-- Video Local (Screen Sharing) -->
            <video 
              v-if="video.id === state.myId && state.localStream"
              ref="localVideo" 
              class="w-full h-full object-cover" 
              autoplay
              controls
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
              controls
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
                <p class="text-xs">({{ state.peers[video.id]?.status || 'Iniciando...' }})</p>
              </div>
            </div>
            
            <!-- Placeholder para video local sin screen sharing -->
            <div 
              v-else-if="video.id === state.myId && !state.localStream" 
              class="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-800"
            >
              <div class="text-center">
                <div class="mb-2">🖥️</div>
                <p>Screen sharing desactivado</p>
                <button 
                  @click="toggleScreenShare" 
                  class="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Compartir Pantalla
                </button>
              </div>
            </div>

            <!-- Indicador de screen sharing activo -->
            <div 
              v-if="video.id === state.myId && state.isScreenSharing" 
              class="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded-full animate-pulse"
            >
              🖥️ SHARING
            </div>
          </div>
        </template>
      </UnifiedVideoGrid>
      
      <!-- Mensaje cuando estás solo -->
      <div v-if="videoList.length <= 1 && state.isConnected" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-500">
          <p>Estás solo en la sala.</p>
          <p class="text-xs">Comparte el enlace para que otros se unan y vean tu pantalla.</p>
      </div>
    </main>

    <!-- Controles de Screen Sharing -->
    <footer class="p-4 border-t border-gray-700 flex justify-center items-center space-x-4">
        <button 
          @click="toggleScreenShare" 
          class="flex items-center justify-center w-14 h-14 rounded-full text-white font-bold transition-colors duration-200" 
          :class="state.isScreenSharing ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'"
        >
          <MaterialIcon 
            :icon="state.isScreenSharing ? 'stop_screen_share' : 'screen_share'" 
            customSize="24px" 
            weight="font-medium"
          />
        </button>
        
        <button 
          @click="toggleAudio" 
          class="flex items-center justify-center w-14 h-14 rounded-full text-white font-bold transition-colors duration-200" 
          :class="state.isAudioEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'"
          title="Incluir audio del sistema en el screen sharing"
        >
          <MaterialIcon 
            :icon="state.isAudioEnabled ? 'mic' : 'mic_off'" 
            customSize="24px" 
            weight="font-medium"
          />
        </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from '@nanostores/vue';
import { screenShareStore, setPeerState, removePeer } from '../lib/screen-store';
import { 
  ScreenWebRTCManager, 
  type ScreenWebRTCCallbacks,
  createScreenManager,
  useWebSocket,
  createSignalingChannel,
  type SignalingCallbacks,
  type ISignalingChannel 
} from '../lib/webrtc/index';
import MaterialIcon from './MaterialIcon.vue';
import UnifiedVideoGrid from './UnifiedVideoGrid.vue';
import apiConfig from '../lib/apiConfig';
import { flexboxConfig } from '../lib/gridConfigs';

// --- 1. INICIALIZACIÓN Y ESTADO ---
// Solo ejecutar en el cliente
const params = typeof window !== 'undefined' 
  ? new URLSearchParams(window.location.search)
  : new URLSearchParams('');

const userId = params.get('userId') || `user_${Math.random().toString(36).substring(2, 5)}`;
const roomId = params.get('roomId') || 'default-room';

// Usamos el store de Nano Stores para el estado reactivo
const state = useStore(screenShareStore);
const localVideo = ref<HTMLVideoElement | null>(null);
const videoGrid = ref<InstanceType<typeof UnifiedVideoGrid> | null>(null);

// Variables no reactivas para nuestras clases gestoras
let webrtc: ScreenWebRTCManager;
let signaling: ISignalingChannel;

// Configuración del grid
const gridConfig = flexboxConfig;

// Lista de videos para el grid
const videoList = computed(() => {
  const videos = [state.value.myId]; // Siempre incluir el video local
  
  // Agregar videos de pares remotos
  Object.keys(state.value.peers).forEach(peerId => {
    if (!videos.includes(peerId)) {
      videos.push(peerId);
    }
  });
  
  return videos;
});

// --- 2. LÓGICA DEL CICLO DE VIDA ---
onMounted(async () => {
  // Inicializa el estado del store con los datos de la URL
  screenShareStore.set({
    myId: userId,
    roomId: roomId,
    status: 'Inicializando...',
    isAudioEnabled: false, // Audio del screen sharing
    isVideoEnabled: false, // Video del screen sharing
    isScreenSharing: false, // Estado de screen sharing
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
  console.log('[CLEANUP] Desmontando componente. Cerrando conexiones...');
  if (webrtc) {
    webrtc.closeAllConnections();
  }
  if (signaling) {
    signaling.disconnect();
  }
  // Detiene las pistas de media
  state.value.localStream?.getTracks().forEach(track => track.stop());
});

// --- 3. FUNCIONES DE INICIALIZACIÓN ---

function initializeWebRTCManager() {
  webrtc = createScreenManager({
    // onSignalNeeded: Cuando WebRTC genera una señal, la enviamos por señalización.
    onSignalNeeded: (peerId: string, signal: any) => {
      console.log(`[WebRTC] Enviando señal a ${peerId}`);
      signaling.sendSignal(peerId, signal);
    },
    // onConnectionStateChange: Actualizamos el estado de la conexión para la UI.
    onConnectionStateChange: (peerId: string, status: string) => {
      console.log(`[WebRTC] Estado de conexión con ${peerId} cambió a: ${status}`);
      setPeerState(peerId, { status });
    },
    // onScreenShareStarted: Cuando inicia el screen sharing
    onScreenShareStarted: (peerId: string, stream: MediaStream) => {
      console.log('[WebRTC] Screen sharing iniciado desde:', peerId);
      if (peerId === 'screen') {
        // Es nuestro propio screen sharing
        screenShareStore.setKey('isScreenSharing', true);
        screenShareStore.setKey('localStream', stream);
      } else {
        // Es screen sharing de un peer remoto
        setPeerState(peerId, { stream: stream });
      }
    },
    // onScreenShareStopped: Cuando se detiene el screen sharing
    onScreenShareStopped: (peerId: string) => {
      console.log('[WebRTC] Screen sharing detenido desde:', peerId);
      if (peerId === 'screen') {
        // Es nuestro propio screen sharing
        screenShareStore.setKey('isScreenSharing', false);
        screenShareStore.setKey('localStream', null);
      } else {
        // Es screen sharing de un peer remoto
        removePeer(peerId);
      }
    },
    // onDataChannelMessage: Para manejar mensajes de datos
    onDataChannelMessage: (peerId: string, message: string) => {
      console.log(`[WebRTC] Mensaje de data channel de ${peerId}:`, message);
      try {
        const data = JSON.parse(message);
        if (data.type === 'screen-metadata') {
          console.log(`[WebRTC] Metadatos de screen sharing de ${peerId}:`, data);
        }
      } catch (error) {
        // Ignorar errores de parsing
      }
    }
  });

  // Pasamos el stream local al gestor si existe
  if (state.value.localStream) {
    // Para screen sharing, el stream ya debería estar configurado en webrtc
  }
}

function initializeSignalingChannel() {
  const signalingUrl = apiConfig.getFullUrl();
  useWebSocket(signalingUrl);

  signaling = createSignalingChannel({ userId, roomId }, {
    // onConnect: Conectado al servidor. Ahora podemos unirnos a la sala.
    onConnect: () => {
      screenShareStore.setKey('status', 'Conectado a señalización. Uniéndose a la sala...');
      // Comprueba si la sala ya existe para decidir si eres el iniciador
      signaling.checkPresence(isRoomExist => {
        screenShareStore.setKey('isInitiator', !isRoomExist);
        // Abre una nueva sala o únete a una existente
        signaling.openOrJoinRoom(!isRoomExist, (response) => {
           screenShareStore.setKey('isConnected', true);
           screenShareStore.setKey('status', `Conectado a la sala ${roomId}`);
           console.log(`[Signaling] ${isRoomExist ? 'Unido' : 'Abierto'} a la sala. Respuesta:`, response);
            
           // Si nos unimos y ya hay otros usuarios, les notificamos para iniciar conexión.
           if (isRoomExist) {
             signaling.sendNewParticipationRequest(roomId);
             // También solicitar screen sharing activo si existe
             setTimeout(() => {
               signaling.sendNewParticipationRequest(roomId);
             }, 1000);
           }
        });
      });
    },

    onDisconnect: () => {
      screenShareStore.setKey('status', 'Desconectado');
      screenShareStore.setKey('isConnected', false);
    },
    
    // onMessage: El corazón de la lógica. Aquí llegan todos los mensajes de otros pares.
    onMessage: async ({message, sender}) => {
      console.log(`[Signaling] Mensaje recibido de ${sender}:`, message);
      if (!sender) {
        console.log("No hay sender", sender, message);
        return;
      }

      // CASO 1: Un nuevo usuario quiere unirse
      if (message.newParticipationRequest) {
        console.log(`[Signaling] ${sender} solicita unirse. Creando oferta...`);
        setPeerState(sender, {});
        await webrtc.createOffer(sender);
      } 
      // CASO 2: Es una señal WebRTC (oferta, respuesta o candidato).
      else if (message.isWebRTCSignal) {
        const signal = message.signal;
        
        if (signal.type === 'offer') {
          console.log(`[Signaling] Oferta recibida de ${sender}. Creando respuesta...`);
          setPeerState(sender, {});
          await webrtc.handleOffer(sender, signal);
        } 
        else if (signal.type === 'answer') {
          console.log(`[Signaling] Respuesta recibida de ${sender}.`);
          await webrtc.handleAnswer(sender, signal);
        }
        else if (signal.candidate) {
          console.log(`[Signaling] Candidato ICE recibido de ${sender}.`);
          await webrtc.addIceCandidate(sender, signal.candidate);
        }
      }
    },
    
    // onUserDisconnected: Un usuario se ha ido. Limpiamos su conexión y estado.
    onUserDisconnected: (disconnectedUserId) => {
      console.log(`[Signaling] Usuario ${disconnectedUserId} se ha desconectado.`);
      webrtc.closeConnection(disconnectedUserId);
      removePeer(disconnectedUserId);
    },
    
    // onRoomOwnerChanged: Informativo, para saber quién es el nuevo 'dueño'.
    onRoomOwnerChanged: (newOwnerId) => {
      console.log(`[Signaling] El nuevo dueño de la sala es ${newOwnerId}`);
    }
  });
}

// --- 4. MANEJADORES DE UI ---

async function toggleScreenShare() {
  try {
    if (state.value.isScreenSharing) {
      // Detener screen sharing
      webrtc.stopScreenShare();
      if (localVideo.value) {
        localVideo.value.srcObject = null;
      }
      screenShareStore.setKey('localStream', null);
    } else {
      // Iniciar screen sharing
      screenShareStore.setKey('status', 'Iniciando screen sharing...');
      const stream = await webrtc.startScreenShare();
      screenShareStore.setKey('localStream', stream);
      
      if (localVideo.value) {
        localVideo.value.srcObject = stream;
      }
    }
  } catch (error) {
    console.error('Error al toggle screen share:', error);
    screenShareStore.setKey('status', 'Error al compartir pantalla');
  }
}

function toggleAudio() {
  const newState = !state.value.isAudioEnabled;
  screenShareStore.setKey('isAudioEnabled', newState);
  // Nota: toggleAudio no existe en ScreenWebRTCManager, necesitaremos implementarlo
  // webrtc.toggleAudio(newState);
}

function toggleVideo() {
  const newState = !state.value.isVideoEnabled;
  screenShareStore.setKey('isVideoEnabled', newState);
  // Nota: toggleVideo no existe en ScreenWebRTCManager, necesitaremos implementarlo
  // webrtc.toggleVideo(newState);
}

// Helper para asignar dinámicamente el stream a los elementos <video>
function setVideoRef(el: HTMLVideoElement | null, stream: MediaStream) {
  if (el) {
    el.srcObject = stream;
  }
}
</script>
