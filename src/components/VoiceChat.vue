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
        class="flex items-center justify-center w-16 h-16 rounded-full text-white font-bold transition-colors duration-200"
        :class="state.isMicEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'"
      >
        <!-- Icono de Micrófono (Material Symbols) -->
        <MaterialIcon 
          :icon="state.isMicEnabled ? 'mic' : 'mic_off'" 
          customSize="32px" 
          weight="font-medium"
        />
      </button>
    </footer>
    
    <!-- Contenedor para los elementos de audio remotos -->
    <div ref="remoteAudioContainer" class="hidden"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useStore } from '@nanostores/vue';
import { voiceChatStore, setVoicePeerState, removeVoicePeer } from '../lib/store';
import { SignalingChannel } from '../lib/webrtc/index';
import { VoiceWebRTCManager, type VoiceWebRTCCallbacks,createVoiceManager,useWebSocket,useSocketIO,createSignalingChannel,type SignalingCallbacks,type ISignalingChannel } from '../lib/webrtc/index';
import apiConfig from '../lib/apiConfig';
import MaterialIcon from './MaterialIcon.vue';

// --- Inicialización y Estado ---
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId') || `user_${Math.random().toString(36).substr(2, 5)}`;
const roomId = params.get('roomId') || 'default-room';
// Todos los usuarios inician como listeners por defecto
const isListener = params.get('mode') !== 'speak'; // Solo si explícitamente se pone mode=speak, no será listener

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
    isMicEnabled: false, // Todos inician con micrófono desactivado
    localStream: null,
    peers: {},
  });

  // Solo solicitar micrófono si explícitamente se especifica mode=speak
  if (!isListener) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      voiceChatStore.setKey('localStream', stream);
      voiceChatStore.setKey('isMicEnabled', true);
      voiceChatStore.setKey('status', 'Micrófono listo. Conectando...');
    } catch (err) {
      console.error("Error al obtener micrófono:", err);
      voiceChatStore.setKey('status', 'ERROR: Se necesita permiso para el micrófono.');
      return;
    }
  } else {
     voiceChatStore.setKey('status', 'Modo escucha. Haz clic en el micrófono para hablar.');
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
    try {
      await webrtc.setLocalStream(state.value.localStream);
      webrtc.toggleMic(state.value.isMicEnabled);
      console.log('[VoiceChat] Stream local configurado correctamente');
    } catch (error) {
      console.error('[VoiceChat] Error al configurar stream local:', error);
      voiceChatStore.setKey('status', 'Error al configurar el audio local.');
    }
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
     onMessage: async ({ extra, message }) => {
        const sender = message.sender;
        if (sender === userId) return; // Ignorar mensajes propios

        // Evitar procesar múltiples mensajes de negociación para el mismo par
        if (state.value.peers[sender] && state.value.peers[sender].status !== 'negotiating') {
          // Ya estamos conectados o desconectados, no renegociar a menos que sea una lógica específica
          // console.log(`[Signal] Ignorando señal para par '${sender}' con estado estable: ${state.value.peers[sender].status}`);
          // return; // Se puede habilitar si se vuelve muy ruidoso
        }
        
        console.log(`[Signal] Procesando mensaje de '${sender}':`, message);

        if (message.newParticipationRequest) {
          // Un nuevo usuario anuncia su presencia.
          // El usuario que YA ESTABA en la sala debe iniciar la llamada hacia el nuevo usuario.
          console.log(`[Signal] Nuevo usuario '${sender}' ha entrado. Como ya estaba en la sala, YO le llamo.`);
          setVoicePeerState(sender, { status: 'negotiating' });
          await webrtc.createOffer(sender);
        } 
        else if (message.isWebRTCSignal) {
          const { signal } = message;

          if (signal.type === 'offer') {
            // Recibimos una oferta. La aceptamos siempre.
            console.log(`[Signal] Oferta recibida de '${sender}'. Aceptando y respondiendo.`);
            setVoicePeerState(sender, { status: 'negotiating' });
            await webrtc.handleOffer(sender, signal);
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

// --- Funciones de Ayuda ---
async function toggleMicrophone() {
  const newMicState = !state.value.isMicEnabled;
  
  // Si estamos activando el micrófono y no tenemos stream local (modo listener)
  if (newMicState && !state.value.localStream) {
    voiceChatStore.setKey('status', 'Solicitando acceso al micrófono...');
    
    try {
      console.log('[VoiceChat] Habilitando micrófono dinámicamente. Peers conectados:', Object.keys(state.value.peers).length);
      
      // Obtener stream de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true } 
      });
      
      // Configurar el stream en el store
      voiceChatStore.setKey('localStream', stream);
      
      // Configurar el stream en el manager (esto manejará la renegociación automáticamente)
      await webrtc.setLocalStream(stream);
      
      // Habilitar el micrófono
      webrtc.toggleMic(true);
      voiceChatStore.setKey('isMicEnabled', true);
      voiceChatStore.setKey('status', 'Micrófono activado. Ahora puedes hablar.');
      
      console.log('[VoiceChat] Micrófono habilitado dinámicamente y configurado correctamente');
      
    } catch (error) {
      console.error('[VoiceChat] Error al habilitar micrófono:', error);
      voiceChatStore.setKey('status', 'Error: No se pudo acceder al micrófono.');
      return;
    }
  } 
  // Si estamos desactivando el micrófono y tenemos stream local
  else if (!newMicState && state.value.localStream) {
    voiceChatStore.setKey('isMicEnabled', false);
    webrtc.toggleMic(false);
    voiceChatStore.setKey('status', 'Micrófono desactivado.');
  }
  // Si solo estamos cambiando el estado del micrófono existente
  else if (state.value.localStream) {
    voiceChatStore.setKey('isMicEnabled', newMicState);
    webrtc.toggleMic(newMicState);
    voiceChatStore.setKey('status', newMicState ? 'Micrófono activado.' : 'Micrófono desactivado.');
  }
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