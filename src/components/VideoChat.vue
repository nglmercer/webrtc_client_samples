<!-- VideoChat.vue -->
<template>
  <div class="flex flex-col h-screen mx-auto p-4 font-sans text-white bg-gray-900">
    <!-- Encabezado -->
    <header class="p-4 border-b border-gray-700 text-center">
      <h1 class="text-2xl font-bold">Sala de Video: {{ state.roomId }}</h1>
      <p class="text-sm text-gray-400">Tu ID: {{ state.myId }} | Estado: {{ state.status }}</p>
    </header>

    <!-- Área de Videos (Cuadrícula) -->
    <main class="flex-grow p-4 my-4 bg-gray-800/50 rounded-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
      
      <!-- Tu Video Local -->
      <div v-if="state.localStream" class="relative bg-black rounded-lg overflow-hidden shadow-lg">
        <video ref="localVideo" class="w-full h-full object-cover" autoplay playsinline muted></video>
        <div class="absolute bottom-0 left-0 bg-black/50 px-2 py-1 text-sm rounded-tr-lg">
          {{ state.myId }} (Tú)
        </div>
      </div>
      
      <!-- Videos de los Pares Remotos -->
      <div v-for="(peer, peerId) in state.peers" :key="peerId" 
           class="relative bg-black rounded-lg overflow-hidden shadow-lg">

           <!-- Renderizamos el video SÓLO si el stream ha llegado -->
           <video v-if="peer.stream"
                  :ref="el => setVideoRef(el as HTMLVideoElement, peer.stream!)"
                  class="w-full h-full object-cover" 
                  autoplay 
                  playsinline>
            </video>

           <!-- Mensaje de estado de conexión para este par -->
           <div v-else class="absolute inset-0 flex items-center justify-center text-gray-400">
             Conectando con {{ peerId }}... ({{ peer.status }})
           </div>

           <!-- Etiqueta con el ID del par -->
           <div class="absolute bottom-0 left-0 bg-black/50 px-2 py-1 text-sm rounded-tr-lg">
             {{ peerId }}
           </div>
      </div>
      
      <!-- Mensaje cuando estás solo -->
      <div v-if="Object.keys(state.peers).length === 0 && state.isConnected" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-gray-500">
          <p>Estás solo en la sala.</p>
          <p class="text-xs">Comparte el enlace para que otros se unan.</p>
      </div>

    </main>

    <!-- Controles -->
    <footer class="p-4 border-t border-gray-700 flex justify-center items-center space-x-4">
        <button @click="handleToggleMic" class="p-3 rounded-full" :class="state.isMicEnabled ? 'bg-blue-600' : 'bg-red-600'">MIC</button>
        <button @click="handleToggleCam" class="p-3 rounded-full" :class="state.isCamEnabled ? 'bg-blue-600' : 'bg-red-600'">CAM</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch , onMounted, onUnmounted } from 'vue';
import { useStore } from '@nanostores/vue';
// ASUMO QUE ESTAS LIBRERÍAS ESTÁN EN `src/lib` O SIMILAR
import { mediaChatStore, setPeerState, removePeer } from './lib/media-store';
import { SignalingChannel } from './lib/index';
import { MediaWebRTCManager, type MediaWebRTCCallbacks } from './lib/index';
import apiConfig from './apiConfig';

// --- 1. INICIALIZACIÓN Y ESTADO ---
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId') || `user_${Math.random().toString(36).substring(2, 5)}`;
const roomId = params.get('roomId') || 'default-room';
const isListener = params.get('mode') === 'listen';

// Usamos el store de Nano Stores para el estado reactivo
const state = useStore(mediaChatStore);
const localVideo = ref<HTMLVideoElement | null>(null);

// Variables no reactivas para nuestras clases gestoras
let webrtc: MediaWebRTCManager;
let signaling: SignalingChannel;

// --- 2. LÓGICA DEL CICLO DE VIDA ---
onMounted(async () => {
  // Inicializa el estado del store con los datos de la URL
  mediaChatStore.set({
    myId: userId,
    roomId: roomId,
    status: 'Inicializando...',
    isMicEnabled: !isListener,
    isCamEnabled: !isListener,
    isConnected: false,
    isInitiator: false,
    localStream: null,
    peers: {},
  });

  // Paso 1: Obtener media local (cámara y micrófono)
  await initializeMedia(); // 1
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
  if (isListener) {
    console.log("Modo oyente, no se solicitará media.");
    return;
  }
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
  webrtc = new MediaWebRTCManager({
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

  signaling = new SignalingChannel(signalingUrl, { userId, roomId }, {
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
    onMessage: async (data) => {
      // Usamos 'as any' porque TypeScript no puede saber el tipo exacto sin más contexto.
      // En una app más compleja, se usarían 'type guards'.
      const message = (data as any).message; 
      const sender = (data as any).sender;
      
      console.log(`[Signaling] Mensaje recibido de ${sender}:`, message);

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

function handleToggleMic() {
  const newState = !state.value.isMicEnabled;
  mediaChatStore.setKey('isMicEnabled', newState);
  webrtc.toggleMic(newState);
}

function handleToggleCam() {
  const newState = !state.value.isCamEnabled;
  mediaChatStore.setKey('isCamEnabled', newState);
  webrtc.toggleCam(newState);
}

// Helper para asignar dinámicamente el stream a los elementos <video>
function setVideoRef(el: HTMLVideoElement | null, stream: MediaStream) {
  if (el) {
    el.srcObject = stream;
  }
}
</script>