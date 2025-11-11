<!-- ScreenShareChat.vue CORREGIDO -->
<template>
  <div class="flex flex-col h-screen mx-auto p-4 font-sans text-white bg-gray-900">
    <!-- Encabezado -->
    <header class="p-4 border-b border-gray-700 text-center">
      <h1 class="text-2xl font-bold">Compartir Pantalla: {{ state.roomId }}</h1>
      <p class="text-sm text-gray-400">Tu ID: {{ state.myId }} | Estado: {{ state.status }}</p>
    </header>

    <!-- Área de Videos -->
    <main class="flex-grow p-4 my-4 bg-gray-800/50 rounded-lg overflow-y-auto">
      <UnifiedVideoGrid 
        :videos="videoList" 
        :config="gridConfig"
        ref="videoGrid"
      >
        <template #video="{ video, isMain, isFocused }">
          <div class="relative bg-black rounded-lg overflow-hidden shadow-lg h-full">
            <!-- Video Local -->
            <video 
              v-if="video.id === state.myId"
              :ref="el => localVideo = el as HTMLVideoElement"
              class="w-full h-full object-cover" 
              autoplay 
              playsinline 
              muted
            ></video>
            
            <!-- Videos Remotos -->
            <video 
              v-else
              :ref="el => setRemoteVideo(el as HTMLVideoElement, video.id)"
              class="w-full h-full object-cover" 
              autoplay 
              playsinline
            ></video>
            
            <!-- Placeholder -->
            <div 
              v-if="!hasStream(video.id)"
              class="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-800"
            >
              <div class="text-center">
                <div class="animate-pulse mb-2">🔄</div>
                <p>{{ video.id === state.myId ? 'Sin pantalla' : `Esperando ${video.id}...` }}</p>
                <p class="text-xs">({{ getPeerStatus(video.id) }})</p>
              </div>
            </div>

            <!-- Etiqueta -->
            <div class="absolute bottom-0 left-0 bg-black/70 px-3 py-2 text-sm rounded-tr-lg backdrop-blur-sm">
              <div class="flex items-center space-x-2">
                <span class="font-medium">
                  {{ video.id === state.myId ? `${video.id} (Tú)` : video.id }}
                </span>
                <div class="flex space-x-1">
                  <span v-if="video.id === state.myId && !state.isMicEnabled" class="text-red-400">🔇</span>
                  <span v-if="video.id === state.myId && state.isScreenSharing" class="text-green-400">🖥️</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </UnifiedVideoGrid>
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
        @click="handleToggleScreenShare" 
        class="flex items-center justify-center w-14 h-14 rounded-full text-white font-bold transition-colors duration-200" 
        :class="state.isScreenSharing ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'"
      >
        <MaterialIcon 
          :icon="state.isScreenSharing ? 'stop_screen_share' : 'screen_share'" 
          customSize="24px" 
          weight="font-medium"
        />
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useStore } from '@nanostores/vue';
import { screenShareStore, setScreenSharePeerState, removeScreenSharePeer } from '../lib/screen-share-store';
import { createScreenShareManager, createSignalingChannel, useWebSocket } from '../lib/webrtc/index';
import MaterialIcon from './MaterialIcon.vue';
import UnifiedVideoGrid from './UnifiedVideoGrid.vue';
import apiConfig from '../lib/apiConfig';
import { flexboxConfig } from '../lib/gridConfigs';
import type { ScreenShareWebRTCManager, ISignalingChannel } from '../lib/webrtc/index';
import type { SignalData } from '../lib/webrtc/signaling/types';

// ===== INICIALIZACIÓN =====
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId') || `user_${Math.random().toString(36).substring(2, 5)}`;
const roomId = params.get('roomId') || 'default-room';

const state = useStore(screenShareStore);
const localVideo = ref<HTMLVideoElement | null>(null);
const videoGrid = ref<InstanceType<typeof UnifiedVideoGrid> | null>(null);
const remoteVideos = ref<Map<string, HTMLVideoElement>>(new Map());

// Control de negociación para evitar glare
const negotiating = ref<Set<string>>(new Set());
const isPolite = ref(false); // Determinado por quién llegó primero

let webrtc: ScreenShareWebRTCManager;
let signaling: ISignalingChannel;

const gridConfig = flexboxConfig;

const videoList = computed(() => {
  const videos = [state.value.myId];
  Object.keys(state.value.peers).forEach(peerId => {
    if (!videos.includes(peerId)) {
      videos.push(peerId);
    }
  });
  return videos;
});

// ===== HELPERS =====
function hasStream(videoId: string): boolean {
  if (videoId === state.value.myId) {
    return !!state.value.localStream;
  }
  return !!state.value.peers[videoId]?.stream;
}

function getPeerStatus(videoId: string): string {
  if (videoId === state.value.myId) return 'local';
  return state.value.peers[videoId]?.status || 'desconocido';
}

function setRemoteVideo(el: HTMLVideoElement | null, peerId: string) {
  if (el) {
    remoteVideos.value.set(peerId, el);
    const stream = state.value.peers[peerId]?.stream;
    if (stream) {
      el.srcObject = stream;
      el.play().catch(e => console.error(`Error playing video for ${peerId}:`, e));
    }
  }
}

// ===== MEDIA =====
async function getScreenShareStream(): Promise<MediaStream | null> {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { 
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      },
      audio: true
    });
    
    // Detectar cuando el usuario detiene el sharing desde el browser
    screenStream.getVideoTracks()[0].addEventListener('ended', () => {
      console.log('[ScreenShare] Usuario detuvo el compartido');
      handleStopScreenShare();
    });
    
    return screenStream;
  } catch (error) {
    console.error("Error obteniendo pantalla:", error);
    return null;
  }
}

async function getAudioStream(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
  } catch (error) {
    console.error("Error obteniendo audio:", error);
    return null;
  }
}

// ===== INICIALIZACIÓN WEBRTC =====
function initializeWebRTC() {
  // ICE servers con TURN para evitar fallos de ICE
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Añade tu servidor TURN aquí si tienes uno
    // { urls: 'turn:your-turn-server.com', username: 'user', credential: 'pass' }
  ];

  webrtc = createScreenShareManager({
    onSignalNeeded: (peerId, signal) => {
      console.log(`[WebRTC] Enviando señal a ${peerId}:`, signal.type);
      signaling.sendSignal(peerId, signal);
    },
    onRemoteStreamAdded: (peerId, stream) => {
      console.log(`[WebRTC] ✅ Stream recibido de ${peerId}`);
      setScreenSharePeerState(peerId, { 
        stream: stream,
        status: 'connected'
      });
      
      // Asignar stream al video element si ya existe
      nextTick(() => {
        const videoEl = remoteVideos.value.get(peerId);
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.play().catch(e => console.error(`Error playing:`, e));
        }
      });
    },
    onConnectionStateChange: (peerId, status) => {
      console.log(`[WebRTC] Conexión con ${peerId}: ${status}`);
      setScreenSharePeerState(peerId, { status });
      
      if (status === 'failed' || status === 'disconnected') {
        console.log(`[WebRTC] Reconectando con ${peerId}...`);
        // Opcional: lógica de reconexión
      }
    }
  });

  // Configurar ICE servers personalizados si es necesario
  // webrtc.setIceServers(iceServers);
}

// ===== INICIALIZACIÓN SIGNALING =====
function initializeSignaling() {
  const signalingUrl = apiConfig.getFullUrl();
  useWebSocket(signalingUrl);

  signaling = createSignalingChannel({ userId, roomId }, {
    onConnect: () => {
      console.log('[Signaling] ✅ Conectado');
      screenShareStore.setKey('status', 'Conectado. Uniéndose...');
      
      signaling.checkPresence(roomExists => {
        const isInitiator = !roomExists;
        isPolite.value = !isInitiator; // El que llega segundo es "polite"
        
        screenShareStore.setKey('isInitiator', isInitiator);
        
        signaling.openOrJoinRoom(isInitiator, (response) => {
          screenShareStore.setKey('isConnected', true);
          screenShareStore.setKey('status', `En sala ${roomId}`);
          console.log(`[Signaling] ${isInitiator ? 'Sala creada' : 'Unido a sala'}`);
          
          if (!isInitiator) {
            // Si no somos iniciadores, notificamos nuestra presencia
            signaling.sendNewParticipationRequest(roomId);
          }
        });
      });
    },

    onDisconnect: () => {
      console.log('[Signaling] ❌ Desconectado');
      screenShareStore.setKey('status', 'Desconectado');
      screenShareStore.setKey('isConnected', false);
    },
    
    onMessage: async (data: SignalData) => {
      console.log(`[Signaling] 📨 Mensaje recibido:`, data);
      
      // Extraer sender y message de data (manejar diferentes formatos)
      let sender = data.sender;
      let message = data.message || data;
      
      // Si el sender viene en el mensaje anidado
      if (!sender && message.sender) {
        sender = message.sender;
      }
      
      // Ignorar mensajes propios o sin sender válido
      if (!sender || sender === userId || sender === 'undefined') {
        console.log(`[Signaling] ⚠️ Ignorando mensaje de sender inválido: ${sender}`);
        return;
      }

      // NEGOCIACIÓN PERFECTA - Perfect Negotiation Pattern
      if (message.isWebRTCSignal) {
        const signal = message.signal;
        const isOfferCollision = signal.type === 'offer' && 
                                 (negotiating.value.has(sender) || 
                                  webrtc.getConnectionState(sender));

        const ignoreOffer = !isPolite.value && isOfferCollision;
        
        if (ignoreOffer) {
          console.log(`[Signaling] ⚠️ Ignorando oferta de ${sender} (collision, no polite)`);
          return;
        }

        try {
          if (signal.type === 'offer') {
            console.log(`[Signaling] 📥 Procesando oferta de ${sender}`);
            negotiating.value.add(sender);
            setScreenSharePeerState(sender, { status: 'negotiating' });
            
            await webrtc.handleOffer(sender, signal);
            negotiating.value.delete(sender);
          }
          else if (signal.type === 'answer') {
            console.log(`[Signaling] 📥 Procesando respuesta de ${sender}`);
            await webrtc.handleAnswer(sender, signal);
            negotiating.value.delete(sender);
          }
          else if (signal.candidate) {
            console.log(`[Signaling] 📥 Añadiendo ICE candidate de ${sender}`);
            await webrtc.addIceCandidate(sender, signal.candidate);
          }
        } catch (error) {
          console.error(`[Signaling] ❌ Error procesando señal:`, error);
          negotiating.value.delete(sender);
        }
      }
      else if (message.newParticipationRequest) {
        console.log(`[Signaling] 🆕 ${sender} solicita unirse`);
        setScreenSharePeerState(sender, { status: 'connecting' });
        
        // Esperar un poco antes de crear la oferta para evitar glare
        setTimeout(async () => {
          negotiating.value.add(sender);
          await webrtc.createOffer(sender);
          // negotiating se elimina cuando recibimos la respuesta
        }, 100);
      }
    },
    
    onUserDisconnected: (disconnectedUserId) => {
      console.log(`[Signaling] 👋 ${disconnectedUserId} desconectado`);
      webrtc.closeConnection(disconnectedUserId);
      removeScreenSharePeer(disconnectedUserId);
      negotiating.value.delete(disconnectedUserId);
    },
    
    onRoomOwnerChanged: (newOwnerId) => {
      console.log(`[Signaling] 👑 Nuevo owner: ${newOwnerId}`);
    }
  });
}

// ===== CONTROLES UI =====
async function handleToggleMic() {
  const newState = !state.value.isMicEnabled;
  
  if (newState) {
    const audioStream = await getAudioStream();
    if (!audioStream) {
      screenShareStore.setKey('status', 'Error: no se pudo acceder al micrófono');
      return;
    }
    
    const audioTrack = audioStream.getAudioTracks()[0];
    
    if (!state.value.localStream) {
      // Solo audio
      const stream = new MediaStream([audioTrack]);
      screenShareStore.setKey('localStream', stream);
      await webrtc.setLocalStream(stream);
    } else {
      // Añadir audio al stream existente
      state.value.localStream.addTrack(audioTrack);
      await webrtc.addMediaTrack(audioTrack);
    }
    
    screenShareStore.setKey('isMicEnabled', true);
    webrtc.toggleMic(true);
    console.log('[Audio] ✅ Micrófono activado');
  } else {
    webrtc.toggleMic(false);
    screenShareStore.setKey('isMicEnabled', false);
    console.log('[Audio] 🔇 Micrófono desactivado');
  }
}

async function handleToggleScreenShare() {
  if (state.value.isScreenSharing) {
    handleStopScreenShare();
  } else {
    await handleStartScreenShare();
  }
}

async function handleStartScreenShare() {
  const screenStream = await getScreenShareStream();
  if (!screenStream) {
    screenShareStore.setKey('status', 'Error: no se pudo compartir pantalla');
    return;
  }
  
  // Si hay audio del mic activo, preservarlo
  if (state.value.isMicEnabled && state.value.localStream) {
    const audioTracks = state.value.localStream.getAudioTracks();
    audioTracks.forEach(track => screenStream.addTrack(track));
  }
  
  screenShareStore.setKey('localStream', screenStream);
  screenShareStore.setKey('isScreenSharing', true);
  screenShareStore.setKey('status', '🖥️ Compartiendo pantalla');
  
  await webrtc.setLocalStream(screenStream);
  console.log('[ScreenShare] ✅ Pantalla compartida');
}

function handleStopScreenShare() {
  if (!state.value.localStream) return;
  
  // Detener solo las pistas de video (pantalla)
  state.value.localStream.getVideoTracks().forEach(track => {
    track.stop();
    state.value.localStream?.removeTrack(track);
  });
  
  screenShareStore.setKey('isScreenSharing', false);
  
  // Si hay audio, mantenerlo
  if (state.value.isMicEnabled) {
    const audioTracks = state.value.localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const audioOnlyStream = new MediaStream(audioTracks);
      screenShareStore.setKey('localStream', audioOnlyStream);
      webrtc.setLocalStream(audioOnlyStream);
      screenShareStore.setKey('status', '🎤 Solo audio activo');
    }
  } else {
    // No hay nada activo
    state.value.localStream.getTracks().forEach(t => t.stop());
    screenShareStore.setKey('localStream', null);
    webrtc.setLocalStream(new MediaStream());
    screenShareStore.setKey('status', 'En sala (sin compartir)');
  }
  
  console.log('[ScreenShare] ⏹️ Compartir detenido');
}

// ===== LIFECYCLE =====
onMounted(async () => {
  screenShareStore.set({
    myId: userId,
    roomId: roomId,
    status: 'Inicializando...',
    isMicEnabled: false,
    isScreenSharing: false,
    isConnected: false,
    isInitiator: false,
    localStream: null,
    peers: {},
  });

  initializeWebRTC();
  initializeSignaling();
  signaling.connect();
  
  // Watch para actualizar el video local
  watch(
    () => state.value.localStream,
    async (newStream) => {
      await nextTick();
      if (localVideo.value && newStream) {
        localVideo.value.srcObject = newStream;
        localVideo.value.play().catch(e => console.error('Error playing local:', e));
      }
    },
    { immediate: true }
  );
});

onUnmounted(() => {
  console.log('[Cleanup] Cerrando todo...');
  webrtc?.closeAllConnections();
  signaling?.disconnect();
  state.value.localStream?.getTracks().forEach(track => track.stop());
});
</script>
