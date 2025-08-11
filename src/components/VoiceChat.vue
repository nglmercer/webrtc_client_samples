<template>
  <div class="flex flex-col h-screen max-w-2xl mx-auto p-4 font-sans text-white bg-gray-900">
    <!-- Encabezado y Estado -->
    <header class="p-4 border-b border-gray-700 text-center">
      <h1 class="text-2xl font-bold">Sala de Voz: {{ state.roomId }}</h1>
      <p class="text-sm text-gray-400">Tu ID: {{ state.myId }}</p>
      <p class="mt-2 text-md" :class="state.isConnected ? 'text-green-400' : 'text-yellow-400'">
        {{ state.status }}
      </p>
    </header>

    <!-- Área de Participantes -->
    <main class="flex-grow p-4 my-4 bg-gray-800/50 rounded-lg overflow-y-auto">
      <h2 class="text-lg font-semibold mb-4 border-b border-gray-600 pb-2">
        Participantes ({{ Object.keys(state.peers).filter(p => state.peers[p]?.status === 'connected').length + 1 }})
      </h2>
      <div class="space-y-3">
         <!-- Tú mismo -->
        <div class="flex items-center p-3 bg-gray-700 rounded-md">
           <span class="w-3 h-3 rounded-full mr-3" :class="state.isMicEnabled ? 'bg-green-500' : 'bg-red-500'"></span>
           <span class="font-medium">{{ state.myId }} (Tú)</span>
        </div>
        <!-- Otros participantes -->
        <div v-for="(peer, peerId) in state.peers" :key="peerId" class="flex items-center p-3 bg-gray-700 rounded-md">
            <span class="w-3 h-3 rounded-full mr-3" :class="peer.status === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'"></span>
            <span class="font-medium">{{ peerId }}</span>
            <span class="ml-auto text-xs text-gray-400">{{ peer.status }}</span>
        </div>
        <div v-if="Object.keys(state.peers).length === 0" class="text-center text-gray-500 mt-8">
            Estás solo en la sala. Comparte el enlace para que otros se unan.
        </div>
      </div>
    </main>

    <!-- Controles -->
    <footer class="p-4 border-t border-gray-700 flex justify-center items-center">
      <button 
        @click="toggleMicrophone"
        :disabled="!state.localStream"
        class="flex items-center justify-center w-16 h-16 rounded-full text-white font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        :class="state.isMicEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'"
      >
        <!-- Icono de Micrófono (SVG) -->
        <svg v-if="state.isMicEnabled" xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.586 15.586a7 7 0 01-9.172 0L3 12.172V10a7 7 0 0114 0v2.172l-2.414 2.414zM6 18v-2M18 18v-2" /></svg>
      </button>
    </footer>
    
    <!-- Contenedor para los elementos de audio remotos -->
    <div ref="remoteAudioContainer" class="hidden"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useStore } from '@nanostores/vue';
import { voiceChatStore, setVoicePeerState, removeVoicePeer } from './lib/store';
import { SignalingChannel } from './lib/index';
import { VoiceWebRTCManager, type VoiceWebRTCCallbacks,createVoiceManager,useWebSocket,useSocketIO,createSignalingChannel,type SignalingCallbacks,type ISignalingChannel } from './lib/index';
import apiConfig from './apiConfig';

// --- Inicialización y Estado ---
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId') || `user_${Math.random().toString(36).substr(2, 5)}`;
const roomId = params.get('roomId') || 'default-room';
const isListener = params.get('mode') === 'listen';

const state = useStore(voiceChatStore);
const remoteAudioContainer = ref<HTMLElement | null>(null);

let webrtc: VoiceWebRTCManager;
let signaling: ISignalingChannel;

// --- Lógica del Ciclo de Vida del Componente ---
onMounted(async () => {
  console.log(`[INIT] Montando componente para ${userId} en sala ${roomId}`);
  
  voiceChatStore.set({
    myId: userId,
    roomId: roomId,
    status: 'Inicializando...',
    isConnected: false,
    isInitiator: false,
    isMicEnabled: !isListener,
    localStream: null,
    peers: {},
  });

  if (!isListener) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      voiceChatStore.setKey('localStream', stream);
      voiceChatStore.setKey('status', 'Micrófono listo. Conectando...');
    } catch (err) {
      console.error("Error al obtener micrófono:", err);
      voiceChatStore.setKey('status', 'ERROR: Se necesita permiso para el micrófono.');
      return;
    }
  } else {
     voiceChatStore.setKey('status', 'Modo escucha. Conectando...');
  }
  
  webrtc = createVoiceManager({
    onSignalNeeded: (peerId, signal) => {
      signaling.sendSignal(peerId, signal);
    },
    onRemoteStreamAdded: (peerId, stream) => {
      handleRemoteStream(peerId, stream);
    },
    onConnectionStateChange: (peerId, connectionState) => {
      console.log(`[WebRTC] Estado de conexión con ${peerId}: ${connectionState}`);
      if (connectionState === 'connected') {
        setVoicePeerState(peerId, { status: 'connected' });
        voiceChatStore.setKey('status', `Conectado a ${peerId}.`);
      } else if (['disconnected', 'failed', 'closed'].includes(connectionState)) {
        if(state.value.peers[peerId]?.status !== 'disconnected') {
            voiceChatStore.setKey('status', `Conexión con ${peerId} perdida.`);
            handleUserDisconnected(peerId);
        }
      }
    },
    onPeerDisconnected: (peerId) => {
      console.log(`[WebRTC] Peer ${peerId} disconnected`);
      handleUserDisconnected(peerId);
    }
  });

  if (state.value.localStream) {
    webrtc.setLocalStream(state.value.localStream);
    webrtc.toggleMic(state.value.isMicEnabled);
  }
  const signalingUrl = apiConfig.getFullUrl();
  console.log(`[DEBUG] Creando SignalingChannel para conectar a: ${signalingUrl}`);
  useWebSocket(signalingUrl);

  const signalingCallbacks: SignalingCallbacks =     {
      onConnect: () => {
        voiceChatStore.setKey('isConnected', true);
        voiceChatStore.setKey('status', 'Conectado. Verificando sala...');
        
        // El nuevo flujo es más robusto y evita race conditions.
        signaling.checkPresence(async (isRoomExist: boolean ) => {
            const isInitiator = !isRoomExist;
            voiceChatStore.setKey('isInitiator', isInitiator);

            signaling.openOrJoinRoom(isInitiator, (response: any) => {
                if (!response.error) {
                    const status = isInitiator ? 'Sala creada. Esperando a otros...' : 'Unido a la sala. Conectando con pares...';
                    voiceChatStore.setKey('status', status);

                    // CAMBIO CLAVE: Si NO soy el iniciador, anuncio mi llegada.
                    // Esto es lo que soluciona el problema. El `newParticipationRequest` ahora solo lo usamos
                    // para que los demás sepan de nuestra existencia y nosotros iniciaremos las llamadas.
                    if (!isInitiator) {
                        console.log('[INIT] No soy iniciador. Anunciando mi presencia...');
                        signaling.sendNewParticipationRequest(roomId);
                    }
                } else {
                    voiceChatStore.setKey('status', `Error al unirse: ${response.error}`);
                }
            });
        });
      },
      onDisconnect: () => {
        voiceChatStore.setKey('isConnected', false);
        voiceChatStore.setKey('status', 'Desconectado del servidor. Recarga la página.');
        webrtc.closeAllConnections();
      },
     onMessage: async ({ sender, message }) => {
        if (sender === userId) return; // Ignorar mensajes propios

        // Evitar procesar múltiples mensajes de negociación para el mismo par
        if (state.value.peers[sender] && state.value.peers[sender].status !== 'negotiating') {
          // Ya estamos conectados o desconectados, no renegociar a menos que sea una lógica específica
          // console.log(`[Signal] Ignorando señal para par '${sender}' con estado estable: ${state.value.peers[sender].status}`);
          // return; // Se puede habilitar si se vuelve muy ruidoso
        }
        
        // --- Lógica de Desempate (Tie-Breaking) ---
        // Comparamos nuestro ID con el del remitente. El que sea "menor" alfabéticamente
        // será el que inicia la llamada (caller) y el "mayor" será el que espera (callee).
        // En nuestro caso, haremos que el de ID menor sea el que llame.
        const amITheCaller = userId < sender;

        if (message.newParticipationRequest) {
          // Un nuevo usuario anuncia su presencia.
          // El usuario con ID MENOR debe iniciar la llamada hacia el nuevo usuario.
          if (amITheCaller) {
            console.log(`[Signal] Nuevo usuario '${sender}' ha entrado. Mi ID es menor, así que YO le llamo.`);
            setVoicePeerState(sender, { status: 'negotiating' });
            await webrtc.createOffer(sender);
          } else {
            console.log(`[Signal] Nuevo usuario '${sender}' ha entrado. Mi ID es mayor, así que ESPERO su llamada.`);
          }
        } 
        else if (message.isWebRTCSignal) {
          const { signal } = message;

          if (signal.type === 'offer') {
            // Recibimos una oferta.
            // Si hay un conflicto (yo también quería llamar), la regla de desempate decide.
            // Si mi ID es mayor (amITheCaller es false), está bien, acepto la oferta.
            // Si mi ID es menor (amITheCaller es true), yo debería haber sido el que llamaba.
            // Esto es un "glare". Debo ignorar su oferta y continuar con la mía.
            if (!amITheCaller) {
                console.log(`[Signal] Oferta recibida de '${sender}'. Mi ID es mayor, así que la acepto y respondo.`);
                setVoicePeerState(sender, { status: 'negotiating' });
                await webrtc.handleOffer(sender, signal);
            } else {
                console.warn(`[Signal] GLARE detectado. Recibí una oferta de '${sender}', pero yo soy el que debe llamar. Ignorando su oferta.`);
            }
          } 
          else if (signal.type === 'answer') {
            console.log(`[Signal] Respuesta recibida de '${sender}'.`);
            await webrtc.handleAnswer(sender, signal);
          } 
          else if (signal.candidate) {
            await webrtc.addIceCandidate(sender, signal.candidate);
          }
        }
      },
      onUserDisconnected: (disconnectedUserId) => {
        if(state.value.peers[disconnectedUserId]){
            voiceChatStore.setKey('status', `Usuario ${disconnectedUserId} se fue.`);
            handleUserDisconnected(disconnectedUserId);
        }
      },
      onRoomOwnerChanged: (newOwnerId) => {
        const amINowTheOwner = newOwnerId === userId;
        voiceChatStore.setKey('isInitiator', amINowTheOwner);
        if (amINowTheOwner) voiceChatStore.setKey('status', '¡Ahora eres el dueño de la sala!');
      }
    }

  signaling = createSignalingChannel(
    { userId, roomId },
    signalingCallbacks
  );

  signaling.connect();
});

onUnmounted(() => {
    console.warn("[CLEANUP] Desmontando componente. Cerrando conexiones.");
    state.value.localStream?.getTracks().forEach(track => track.stop());
    webrtc?.closeAllConnections();
    signaling?.disconnect();
});

// --- Funciones de Ayuda (sin cambios) ---
function toggleMicrophone() {
  if (isListener) return; // Un listener no puede controlar el micro
  const newMicState = !state.value.isMicEnabled;
  voiceChatStore.setKey('isMicEnabled', newMicState);
  webrtc.toggleMic(newMicState);
}

function handleRemoteStream(peerId: string, stream: MediaStream) {
  if (!remoteAudioContainer.value) return;
  const existingAudio = document.getElementById(`audio-${peerId}`);
  if (existingAudio) return;
  console.log(`[UI] Creando elemento de audio para ${peerId}`);
  const audio = document.createElement('audio');
  audio.id = `audio-${peerId}`;
  audio.srcObject = stream;
  audio.autoplay = true;
  remoteAudioContainer.value.appendChild(audio);
}

function handleUserDisconnected(peerId: string) {
  webrtc.closeConnection(peerId);
  removeVoicePeer(peerId);
  const audio = document.getElementById(`audio-${peerId}`);
  if (audio) {
    audio.remove();
    console.log(`[UI] Elemento de audio para ${peerId} eliminado.`);
  }
}
</script>