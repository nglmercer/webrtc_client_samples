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
// Chat.vue <script setup> - Solo la parte modificada

import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useStore } from '@nanostores/vue';
import { chatStore, addMessage, setPeerState, removePeer } from '../lib/store';
import { 
  DataWebRTCManager,
  type DataWebRTCCallbacks,
  useSocketIO,
  useWebSocket,
  createSignalingChannel,
  type SignalingCallbacks,
  type ISignalingChannel 
} from '../lib/webrtc/index';
import { SignalingHandler } from '../lib/webrtc/core/signaling-handler';
import apiConfig from '../lib/apiConfig';
import { logger, LogLevel } from '../lib/utils/logger';

const params = new URLSearchParams(window.location.search);
const userId = params.get('userId') as string;
const roomId = params.get('roomId') as string;

if (!userId || !roomId) {
  logger.error('userId o roomId no proporcionados en la URL. Redirigiendo...');
}

const state = useStore(chatStore);
const newMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);

let webrtc: DataWebRTCManager;
let signaling: ISignalingChannel;
let signalingHandler: SignalingHandler;

onMounted(() => {
  logger.info(`Componente montado. Iniciando chat para userId: ${userId} en roomId: ${roomId}`);
  
  chatStore.setKey('roomId', roomId);
  chatStore.setKey('myId', userId);
  chatStore.setKey('status', 'Inicializando...');
  chatStore.setKey('peers', {});
  chatStore.setKey('messages', []);

  // 🎯 CONFIGURAR CALLBACKS DE WEBRTC
  const dataCallbacks: DataWebRTCCallbacks = {
    onSignalNeeded: (peerId, signal) => {
      logger.signalingDebug(`DataWebRTC -> onSignalNeeded para ${peerId}. Enviando señal...`, signal);
      signaling.sendSignal(peerId, signal);
    },
    onDataChannelMessage: (peerId, messageText) => {
      logger.webrtcDebug(`DataWebRTC -> onDataChannelMessage de ${peerId}: ${messageText}`);
      try {
        const message = JSON.parse(messageText);
        addMessage({ ...message, timestamp: Date.now() });
      } catch (e) {
        logger.error("Error al parsear mensaje JSON:", e);
      }
    },
    onConnectionStateChange: (peerId, connectionState) => {
      logger.webrtcInfo(`DataWebRTC -> onConnectionStateChange para ${peerId}: ${connectionState}`);
      
      if (connectionState === 'connected') {
        setPeerState(peerId, { status: 'connected' });
        chatStore.setKey('status', `Conectado a ${peerId}.`);
        
        // 🎯 Limpiar estado del handler cuando la conexión está establecida
        signalingHandler.cleanupPeer(peerId);
      } else if (['disconnected', 'failed', 'closed'].includes(connectionState)) {
        if (state.value.peers[peerId]?.status !== 'disconnected') {
          logger.warn(`Conexión con ${peerId} perdida. Estado: ${connectionState}. Limpiando...`);
          chatStore.setKey('status', `Conexión con ${peerId} perdida.`);
          webrtc.closeConnection(peerId);
          removePeer(peerId);
          
          // 🎯 Limpiar estado del handler
          signalingHandler.handleUserDisconnected(peerId);
        }
      }
    },
    onPeerDisconnected: (peerId) => {
      logger.warn(`Peer ${peerId} desconectado completamente`);
      removePeer(peerId);
      signalingHandler.handleUserDisconnected(peerId);
    }
  };

  webrtc = new DataWebRTCManager(dataCallbacks);

  // 🎯 CREAR SIGNALING HANDLER
  signalingHandler = new SignalingHandler({
    localUserId: userId,
    onShouldCreateOffer: async (remoteUserId) => {
      await webrtc.createOffer(remoteUserId);
    },
    onShouldHandleOffer: async (remoteUserId, offer) => {
      await webrtc.handleOffer(remoteUserId, offer);
    },
    onShouldHandleAnswer: async (remoteUserId, answer) => {
      await webrtc.handleAnswer(remoteUserId, answer);
    },
    onShouldHandleCandidate: async (remoteUserId, candidate) => {
      await webrtc.addIceCandidate(remoteUserId, candidate);
    }
  });

  // 🎯 CONFIGURAR CALLBACKS DE SIGNALING
  const signalingUrl = apiConfig.getFullUrl();
  logger.debug(`Creando SignalingChannel para conectar a: ${signalingUrl}`);
  useWebSocket(signalingUrl);
  
  const signalingCallbacks: SignalingCallbacks = {
    onConnect: () => {
      logger.signalingInfo("Signaling -> onConnect: ¡Conectado al servidor de señalización!");
      chatStore.setKey('isConnected', true);
      chatStore.setKey('status', 'Conectado. Verificando sala...');
      
      logger.debug("Signaling: Enviando 'check-presence' al servidor.");
      signaling.checkPresence((isRoomExist: boolean) => {
        logger.debug(`Signaling: Respuesta de 'check-presence'. La sala existe: ${isRoomExist}`);
        const isInitiator = !isRoomExist;
        chatStore.setKey('isInitiator', isInitiator);

        logger.debug(`Signaling: Soy el iniciador: ${isInitiator}. Intentando unirse/crear sala.`);
        signaling.openOrJoinRoom(isInitiator, (response: any) => {
          logger.debug("Signaling: Respuesta de 'open-or-join-room':", response);
          if (response) {
            const status = isInitiator 
              ? 'Sala creada. Esperando a otros...' 
              : 'Unido a la sala. Enviando solicitud de conexión...';
            chatStore.setKey('status', status);
            
            // 🎯 SOLUCIÓN: Enviar newParticipationRequest para iniciar WebRTC
            // Si no somos el iniciador, enviamos la solicitud a los usuarios existentes
            logger.debug(`Respuesta completa del servidor:`, response);
            logger.debug(`¿No es iniciador?: ${!isInitiator}`);
            
            // Si no somos el iniciador, enviar solicitud de participación después de unirnos
            if (!isInitiator) {
              logger.info(`No somos el iniciador. Enviando solicitud de participación a la sala...`);
              
              // Esperar un poco para asegurar que la conexión WebSocket esté estable
              setTimeout(() => {
                signaling.sendNewParticipationRequest(roomId);
              }, 1000);
            } else {
              logger.info(`Somos el iniciador. Esperando que otros usuarios se unan...`);
            }
          } else {
            const errorMsg = `Error al unirse a la sala`;
            logger.error(`Signaling: ${errorMsg}`, response);
            chatStore.setKey('status', errorMsg);
          }
        });
      });
    },
    
    onDisconnect: () => {
      logger.signalingError("Signaling -> onDisconnect: ¡Desconectado del servidor de señalización!");
      chatStore.setKey('isConnected', false);
      chatStore.setKey('status', 'Desconectado del servidor. Intenta recargar.');
      webrtc.closeAllConnections();
    },
    
    onMessage: async ({ extra, message }) => {
      const sender = message.sender;
      logger.signalingDebug(`Signaling -> onMessage: Mensaje recibido de ${sender}`, message);

      // 🎯 DELEGAR AL SIGNALING HANDLER
      if (message.newParticipationRequest) {
        logger.info(`Manejando 'newParticipationRequest' de ${sender}`);
        chatStore.setKey('status', `Conectando con ${sender}...`);
        setPeerState(sender, { status: 'negotiating' });
        
        await signalingHandler.handleNewParticipationRequest(sender);
        
      } else if (message.isWebRTCSignal) {
        logger.info(`Manejando 'isWebRTCSignal' de ${sender}`, message);
        const { signal } = message;
        
        if (signal.type === 'offer') {
          logger.debug(`...es una oferta (offer).`);
          setPeerState(sender, { status: 'negotiating' });
          await signalingHandler.handleIncomingOffer(sender, signal);
          
        } else if (signal.type === 'answer') {
          logger.debug(`...es una respuesta (answer).`);
          await signalingHandler.handleIncomingAnswer(sender, signal);
          
        } else if (signal.candidate) {
          logger.debug(`...es un candidato ICE.`);
          await signalingHandler.handleIncomingCandidate(sender, signal.candidate);
          
        } else {
          logger.warn("Señal WebRTC desconocida:", signal);
        }
      }
    },
    
    onUserDisconnected: (disconnectedUserId) => {
      if (state.value.peers[disconnectedUserId]) {
        logger.warn(`Signaling -> onUserDisconnected: Usuario ${disconnectedUserId} se ha desconectado.`);
        chatStore.setKey('status', `Usuario ${disconnectedUserId} se fue.`);
        webrtc.closeConnection(disconnectedUserId);
        removePeer(disconnectedUserId);
        signalingHandler.handleUserDisconnected(disconnectedUserId);
      }
    },
    
    onRoomOwnerChanged: (newOwnerId) => {
      logger.info(`Signaling -> onRoomOwnerChanged: El nuevo dueño es ${newOwnerId}`);
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
  
  logger.debug("Llamando a signaling.connect()...");
  signaling.connect();

  // 🎯 ESCUCHAR EVENTO DE NUEVO USUARIO
  const { socket } = signaling;
  if (socket) {
    socket.on('user-connected', async (newUserId: string) => {
      logger.info(`Nuevo usuario conectado: ${newUserId}`);
      
      // 🎯 DELEGAR AL SIGNALING HANDLER
      await signalingHandler.handleUserConnected(newUserId);
    });
  }
});

onUnmounted(() => {
  logger.warn("Componente desmontado. Cerrando todas las conexiones.");
  webrtc.closeAllConnections();
  if (signaling) {
    signaling.disconnect();
  }
});

function sendMessage() {
  if (!newMessage.value.trim() || Object.keys(state.value.peers).length === 0) return;
  
  const messagePayload = { 
    senderId: userId, 
    senderName: userId, 
    text: newMessage.value.trim() 
  };
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
}, { deep: true });
</script>
