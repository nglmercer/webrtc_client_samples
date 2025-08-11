<template>
  <!-- ... tu template no cambia, lo omito por brevedad ... -->
  <div class="flex flex-col h-screen max-w-4xl mx-auto p-4">
    <!-- Encabezado y Estado -->
    <header class="p-4 border-b border-gray-700">
      <h1 class="text-xl font-bold">Sala: {{ state.roomId }}</h1>
      <p class="text-sm text-gray-400">Tu Nombre: {{ state.myId }}</p>
      <p class="text-sm" :class="state.isConnected ? 'text-green-400' : 'text-yellow-400'">
        {{ state.status }}
      </p>
      <div class="text-xs text-gray-500 mt-2">
        Conectado con: {{ Object.keys(state.peers).filter(p => state.peers[p]?.status === 'connected').length }} usuario(s)
      </div>
    </header>

    <!-- Área de Mensajes -->
    <div ref="messagesContainer" class="flex-grow p-4 overflow-y-auto space-y-4 bg-gray-800/50 rounded-md my-4">
      <div v-for="(msg, index) in state.messages" :key="index"
           :class="['flex', msg.senderId === state.myId ? 'justify-end' : 'justify-start']">
        <div :class="['max-w-xs lg:max-w-md p-3 rounded-lg', msg.senderId === state.myId ? 'bg-blue-600' : 'bg-gray-700']">
          <p class="font-bold text-sm">{{ msg.senderId === state.myId ? 'Tú' : msg.senderName }}</p>
          <p class="text-white break-words">{{ msg.text }}</p>
          <p class="text-xs text-gray-400 text-right mt-1">{{ new Date(msg.timestamp).toLocaleTimeString() }}</p>
        </div>
      </div>
    </div>

    <!-- Input para enviar mensajes -->
    <footer class="p-4 border-t border-gray-700">
      <form @submit.prevent="sendMessage" class="flex items-center space-x-2">
        <input
          v-model="newMessage"
          type="text"
          placeholder="Escribe un mensaje..."
          :disabled="!state.isConnected"
          class="flex-grow px-3 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button type="submit" :disabled="!state.isConnected || Object.keys(state.peers).length === 0" class="px-4 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">
          Enviar
        </button>
      </form>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { chatStore, addMessage, setPeerState, removePeer } from '../lib/store';
import { DataWebRTCManager,type DataWebRTCCallbacks,useSocketIO,useWebSocket,createSignalingChannel,type SignalingCallbacks,type ISignalingChannel } from '../lib/webrtc/index';
import apiConfig from '../lib/apiConfig';
const params = new URLSearchParams(window.location.search);
const userId = params.get('userId') as string;
const roomId = params.get('roomId') as string;

if (!userId || !roomId){
    console.error('DEBUG: userId o roomId no proporcionados en la URL. Redirigiendo...');
    // window.location.href = '/'; // Comentado para que puedas ver el error en consola
}

const state = useStore(chatStore);
const newMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

let webrtc: DataWebRTCManager;
let signaling: ISignalingChannel;

onMounted(() => {
  console.log(`%c[DEBUG] Componente montado. Iniciando chat para userId: ${userId} en roomId: ${roomId}`, 'color: cyan; font-weight: bold;');
  
  chatStore.setKey('roomId', roomId);
  chatStore.setKey('myId', userId);
  chatStore.setKey('status', 'Inicializando...');
  chatStore.setKey('peers', {});
  chatStore.setKey('messages', []);

  const dataCallbacks: DataWebRTCCallbacks = {
    onSignalNeeded: (peerId, signal) => {
      console.log(`%c[DEBUG] DataWebRTC -> onSignalNeeded para ${peerId}. Enviando señal...`, 'color: orange;');
      console.log({signal});
      signaling.sendSignal(peerId, signal);
    },
    onDataChannelMessage: (peerId, messageText) => {
      console.log(`[DEBUG] DataWebRTC -> onDataChannelMessage de ${peerId}:`, messageText);
      try {
        const message = JSON.parse(messageText);
        addMessage({ ...message, timestamp: Date.now() });
      } catch (e) {
        console.error("[DEBUG] Error al parsear mensaje JSON:", e);
      }
    },
    onConnectionStateChange: (peerId, connectionState) => {
      console.info(`%c[DEBUG] DataWebRTC -> onConnectionStateChange para ${peerId}: ${connectionState}`, 'color: lightblue;');
      if (connectionState === 'connected') {
        setPeerState(peerId, { status: 'connected' });
        chatStore.setKey('status', `Conectado a ${peerId}.`);
      } else if (['disconnected', 'failed', 'closed'].includes(connectionState)) {
        if(state.value.peers[peerId]?.status !== 'disconnected') {
            console.warn(`[DEBUG] Conexión con ${peerId} perdida. Estado: ${connectionState}. Limpiando...`);
            chatStore.setKey('status', `Conexión con ${peerId} perdida.`);
            webrtc.closeConnection(peerId);
            removePeer(peerId);
        }
      }
    },
    onPrivateMessage: (fromPeerId, toPeerId, message) => {
      console.log(`[DEBUG] Mensaje privado de ${fromPeerId} para ${toPeerId}: ${message}`);
      // Aquí podrías manejar mensajes privados si los implementas en el futuro
    }
  };

  webrtc = new DataWebRTCManager(dataCallbacks);

  const signalingUrl = apiConfig.getFullUrl();
  console.log(`[DEBUG] Creando SignalingChannel para conectar a: ${signalingUrl}`);
  useWebSocket(signalingUrl);
  const signalingCallbacks: SignalingCallbacks = {
      onConnect: () => {
        console.log("%c[DEBUG] Signaling -> onConnect: ¡Conectado al servidor de señalización!", "color: green; font-weight: bold;");
        chatStore.setKey('isConnected', true);
        chatStore.setKey('status', 'Conectado. Verificando sala...');
        
        console.log("[DEBUG] Signaling: Enviando 'check-presence' al servidor.");
        signaling.checkPresence((isRoomExist: boolean) => {
            console.log(`[DEBUG] Signaling: Respuesta de 'check-presence'. La sala existe: ${isRoomExist}`);
            const isInitiator = !isRoomExist;
            chatStore.setKey('isInitiator', isInitiator);

            console.log(`[DEBUG] Signaling: Soy el iniciador: ${isInitiator}. Intentando unirse/crear sala.`);
            signaling.openOrJoinRoom(isInitiator, (response: any) => {
                console.log("[DEBUG] Signaling: Respuesta de 'open-or-join-room':", response);
                if(response){
                    const status = isInitiator ? 'Sala creada. Esperando a otros...' : 'Unido a la sala. Anunciando presencia...';
                    chatStore.setKey('status', status);
                    if (!isInitiator) {
                        console.log("[DEBUG] Signaling: No soy iniciador, enviando 'new-participation-request'.");
                        signaling.sendNewParticipationRequest(roomId);
                    }
                } else {
                    const errorMsg = `Error al unirse:`;
                    console.error(`[DEBUG] Signaling: ${errorMsg}`,response);
                    chatStore.setKey('status', errorMsg);
                }
            });
        });
      },
      onDisconnect: () => {
        console.error("[DEBUG] Signaling -> onDisconnect: ¡Desconectado del servidor de señalización!");
        chatStore.setKey('isConnected', false);
        chatStore.setKey('status', 'Desconectado del servidor. Intenta recargar.');
        webrtc.closeAllConnections();
      },
      onMessage: async ({ extra, message }) => {
        const sender = message.sender;
        console.log(`%c[DEBUG] Signaling -> onMessage: Mensaje recibido de ${sender}`, 'color: yellow;');
        console.log({ message });

        if (message.newParticipationRequest) {
            console.info(`[DEBUG] Manejando 'newParticipationRequest' de ${sender}. Creando oferta WebRTC...`);
            chatStore.setKey('status', `Conectando con ${sender}...`);
            setPeerState(sender, { status: 'negotiating' });
            await webrtc.createOffer(sender);
        } else if (message.isWebRTCSignal) {
            console.info(`[DEBUG] Manejando 'isWebRTCSignal' de ${sender}.`,message);
            const { signal } = message;
            if (signal.type === 'offer') {
                console.log(`[DEBUG] ...es una oferta (offer). Creando respuesta...`);
                setPeerState(sender, { status: 'negotiating' });
                await webrtc.handleOffer(sender, signal);
            } else if (signal.type === 'answer') {
                console.log(`[DEBUG] ...es una respuesta (answer). Estableciendo conexión...`);
                await webrtc.handleAnswer(sender, signal);
            } else if (signal.candidate) {
                console.log(`[DEBUG] ...es un candidato ICE. Añadiendo...`);
                await webrtc.addIceCandidate(sender, signal.candidate);
            } else {
                 console.warn("[DEBUG] Señal WebRTC desconocida:", signal);
            }
        }
      },
      onUserDisconnected: (disconnectedUserId) => {
        if(state.value.peers[disconnectedUserId]){
            console.warn(`[DEBUG] Signaling -> onUserDisconnected: Usuario ${disconnectedUserId} se ha desconectado.`);
            chatStore.setKey('status', `Usuario ${disconnectedUserId} se fue.`);
            webrtc.closeConnection(disconnectedUserId);
            removePeer(disconnectedUserId);
        }
      },
      onRoomOwnerChanged: (newOwnerId) => {
        console.info(`[DEBUG] Signaling -> onRoomOwnerChanged: El nuevo dueño es ${newOwnerId}`);
        const amINowTheOwner = newOwnerId === userId;
        chatStore.setKey('isInitiator', amINowTheOwner);
        if (amINowTheOwner) {
            chatStore.setKey('status', '¡Ahora eres el dueño de la sala!');
        }
      }
    };
  signaling = createSignalingChannel(
    { userId: userId, roomId: roomId },
      signalingCallbacks
  );

  console.log("[DEBUG] Llamando a signaling.connect()...");
  signaling.connect();
});

onUnmounted(() => {
    console.warn("[DEBUG] Componente desmontado. Cerrando todas las conexiones.");
    webrtc.closeAllConnections();
    if(signaling) {
      signaling.disconnect();
    }
});

function sendMessage() {
  if (!newMessage.value.trim() || Object.keys(state.value.peers).length === 0) return;
  const messagePayload = { senderId: userId, senderName: userId, text: newMessage.value.trim() };
  const messageString = JSON.stringify(messagePayload);
  addMessage({ ...messagePayload, timestamp: Date.now() });
  webrtc.sendChatMessage('broadcast', messageString);
  newMessage.value = '';
}

watch(() => state.value.messages, async () => {
    await nextTick();
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  }, { deep: true }
);
</script>