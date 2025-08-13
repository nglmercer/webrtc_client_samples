<!-- VideoChat.vue -->
<template>
  <div class="flex flex-col h-screen mx-auto p-4 font-sans text-white bg-gray-900">
    <!-- Encabezado -->
    <header class="p-4 border-b border-gray-700 text-center">
      <h1 class="text-2xl font-bold">Sala de Video: {{ state.roomId }}</h1>
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
                <p class="text-xs">({{ state.peers[video.id]?.status || 'Iniciando...' }})</p>
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

            <!-- Etiqueta con información del usuario -->
            <div class="absolute bottom-0 left-0 bg-black/70 px-3 py-2 text-sm rounded-tr-lg backdrop-blur-sm">
              <div class="flex items-center space-x-2">
                <span class="font-medium">
                  {{ video.id === state.myId ? `${video.id} (Tú)` : video.id }}
                </span>
                <!-- Indicadores de estado -->
                <div class="flex space-x-1">
                  <span v-if="video.id === state.myId && !state.isMicEnabled" class="text-red-400">🔇</span>
                  <span v-if="video.id === state.myId && !state.isCamEnabled" class="text-red-400">📹</span>
                  <span v-if="isMain" class="text-blue-400">👑</span>
                  <span v-if="isFocused" class="text-yellow-400">⭐</span>
                </div>
              </div>
            </div>
            
            <!-- Indicador de actividad de audio (opcional) -->
            <div 
              v-if="video.id === state.myId && state.isMicEnabled" 
              class="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse"
            ></div>
          </div>
        </template>
      </UnifiedVideoGrid>
      
      <!-- Mensaje cuando estás solo -->
      <div v-if="videoList.length <= 1 && state.isConnected" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-500">
          <p>Estás solo en la sala.</p>
          <p class="text-xs">Comparte el enlace para que otros se unan.</p>
      </div>
    </main>

    <!-- Controles -->
    <footer class="p-4 border-t border-gray-700 flex justify-center items-center space-x-4">
        <button 
          @click="handleToggleMic" 
          class="flex items-center justify-center w-14 h-14 rounded-full text-white font-bold transition-colors duration-200" 
          :class="state.isMicEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'"
        >
          <MaterialIcon 
            :icon="state.isMicEnabled ? 'mic' : 'mic_off'" 
            customSize="24px" 
            weight="font-medium"
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
            weight="font-medium"
          />
        </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted, onUnmounted } from 'vue';
import { useStore } from '@nanostores/vue';
// ASUMO QUE ESTAS LIBRERÍAS ESTÁN EN `src/lib` O SIMILAR
import { mediaChatStore, setPeerState, removePeer } from '../lib/media-store';
import { SignalingChannel } from '../lib/webrtc/index';
import { MediaWebRTCManager, type MediaWebRTCCallbacks,createMediaManager } from '../lib/webrtc/index';
import { DataWebRTCManager,type DataWebRTCCallbacks,useSocketIO,useWebSocket,createSignalingChannel,type SignalingCallbacks,type ISignalingChannel } from '../lib/webrtc/index';
import MaterialIcon from './MaterialIcon.vue';
import UnifiedVideoGrid from './UnifiedVideoGrid.vue';
import apiConfig from '../lib/apiConfig';
import { flexboxConfig } from '../lib/gridConfigs';

// --- 1. INICIALIZACIÓN Y ESTADO ---
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId') || `user_${Math.random().toString(36).substring(2, 5)}`;
const roomId = params.get('roomId') || 'default-room';
// Eliminamos isListener para que todos comiencen como listeners por defecto

// Usamos el store de Nano Stores para el estado reactivo
const state = useStore(mediaChatStore);
const localVideo = ref<HTMLVideoElement | null>(null);
const videoGrid = ref<InstanceType<typeof UnifiedVideoGrid> | null>(null);

// Variables no reactivas para nuestras clases gestoras
let webrtc: MediaWebRTCManager;
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
  mediaChatStore.set({
    myId: userId,
    roomId: roomId,
    status: 'Inicializando...',
    isMicEnabled: false, // Por defecto desactivado
    isCamEnabled: false, // Por defecto desactivado
    isConnected: false,
    isInitiator: false,
    localStream: null,
    peers: {},
  });

  // No inicializamos media aquí, se hará al activar toggles
  initializeWebRTCManager(); // 2
  initializeSignalingChannel(); // 3
  signaling.connect(); // 4
  watch(
  () => state.value.localStream,
  async (newStream) => {
    await nextTick(); // Espera a que el DOM esté actualizado
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
  // Detiene las pistas de media para apagar la cámara/mic
  state.value.localStream?.getTracks().forEach(track => track.stop());
});

// --- 3. FUNCIONES DE INICIALIZACIÓN ---

async function initializeMedia() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    mediaChatStore.setKey('localStream', stream);
    if (localVideo.value) {
      localVideo.value.srcObject = stream;
    }
  } catch (error) {
    console.error("Error al obtener media:", error);
    mediaChatStore.setKey('status', 'Error de media. Revisa permisos.');
  }
}

function initializeWebRTCManager() {

  webrtc = createMediaManager({
    // onSignalNeeded: Cuando WebRTC genera una señal, la enviamos por señalización.
    onSignalNeeded: (peerId, signal) => {
      console.log(`[WebRTC] Enviando señal a ${peerId}`);
      signaling.sendSignal(peerId, signal);
    },
    // onRemoteStreamAdded: Cuando llega un stream remoto, lo guardamos en el estado del par.
    onRemoteStreamAdded: (peerId, stream) => {
      console.log(`[WebRTC] Stream recibido de ${peerId}`);
      setPeerState(peerId, { stream: stream });
    },
    // onConnectionStateChange: Actualizamos el estado de la conexión para la UI.
    onConnectionStateChange: (peerId, status) => {
      console.log(`[WebRTC] Estado de conexión con ${peerId} cambió a: ${status}`);
      setPeerState(peerId, { status });
    }
  });

  // Pasamos el stream local al gestor
  if (state.value.localStream) {
    webrtc.setLocalStream(state.value.localStream);
  }
}

function initializeSignalingChannel() {
  const signalingUrl = apiConfig.getFullUrl();
  useWebSocket(signalingUrl);

  signaling = createSignalingChannel({ userId, roomId }, {
    // onConnect: Conectado al servidor. Ahora podemos unirnos a la sala.
    onConnect: () => {
      mediaChatStore.setKey('status', 'Conectado a señalización. Uniéndose a la sala...');
      // Comprueba si la sala ya existe para decidir si eres el iniciador
      signaling.checkPresence(isRoomExist => {
        mediaChatStore.setKey('isInitiator', !isRoomExist);
        // Abre una nueva sala o únete a una existente
        signaling.openOrJoinRoom(!isRoomExist, (response) => {
           mediaChatStore.setKey('isConnected', true);
           mediaChatStore.setKey('status', `Conectado a la sala ${roomId}`);
           console.log(`[Signaling] ${isRoomExist ? 'Unido' : 'Abierto'} a la sala. Respuesta:`, response);
            
           // Si nos unimos y ya hay otros usuarios, les notificamos para iniciar conexión.
           if (isRoomExist) {
             // Este es el flujo donde el nuevo notifica al 'dueño' (o a todos).
             // El dueño responderá con una oferta.
             signaling.sendNewParticipationRequest(roomId);
           }
        });
      });
    },

    onDisconnect: () => {
      mediaChatStore.setKey('status', 'Desconectado');
      mediaChatStore.setKey('isConnected', false);
    },
    
    // onMessage: El corazón de la lógica. Aquí llegan todos los mensajes de otros pares.
    onMessage: async ({message,sender}) => {
      console.log(`[Signaling] Mensaje recibido de ${sender}:`, message);
      if (!sender){
        console.log("No hay sender",sender,message)
        return;
      }

      // CASO 1: Un nuevo usuario quiere unirse (lo recibe el 'dueño' de la sala).
      if (message.newParticipationRequest) {
        console.log(`[Signaling] ${sender} solicita unirse. Creando oferta...`);
        setPeerState(sender, {}); // Crea una entrada para el nuevo par en el store
        await webrtc.createOffer(sender);
      } 
      // CASO 2: Es una señal WebRTC (oferta, respuesta o candidato).
      else if (message.isWebRTCSignal) {
        const signal = message.signal;
        
        if (signal.type === 'offer') {
          console.log(`[Signaling] Oferta recibida de ${sender}. Creando respuesta...`);
          setPeerState(sender, {}); // Asegura que el par exista en el estado
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
      removePeer(disconnectedUserId); // Elimina el par del store
    },
    
    // onRoomOwnerChanged: Informativo, para saber quién es el nuevo 'dueño'.
    onRoomOwnerChanged: (newOwnerId) => {
      console.log(`[Signaling] El nuevo dueño de la sala es ${newOwnerId}`);
      // Podrías guardar esto en el store si tu lógica lo necesita
    }
  });
}

// --- 4. MANEJADORES DE UI ---

async function getLocalMedia(constraints: MediaStreamConstraints) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    console.error("Error al obtener media:", error);
    mediaChatStore.setKey('status', 'Error de media. Revisa permisos o dispositivos.');
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

// Helper para asignar dinámicamente el stream a los elementos <video>
function setVideoRef(el: HTMLVideoElement | null, stream: MediaStream) {
  if (el) {
    el.srcObject = stream;
  }
}
</script>