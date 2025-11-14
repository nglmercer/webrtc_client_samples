<!-- LoggerControl.vue - Componente para controlar el sistema de logging -->
<template>
  <div class="fixed bottom-4 right-4 bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-lg z-50 max-w-sm">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-white font-semibold">Control de Logs</h3>
      <button 
        @click="togglePanel" 
        class="text-gray-400 hover:text-white transition-colors"
      >
        <MaterialIcon :icon="isExpanded ? 'expand_less' : 'expand_more'" />
      </button>
    </div>
    
    <div v-if="isExpanded" class="space-y-3">
      <!-- Nivel de log -->
      <div>
        <label class="text-gray-300 text-sm block mb-1">Nivel de Log</label>
        <select 
          v-model="currentLevel" 
          @change="onLevelChange"
          class="w-full bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-sm"
        >
          <option :value="LogLevel.DEBUG">DEBUG</option>
          <option :value="LogLevel.INFO">INFO</option>
          <option :value="LogLevel.WARN">WARN</option>
          <option :value="LogLevel.ERROR">ERROR</option>
          <option :value="LogLevel.OFF">OFF</option>
        </select>
      </div>
      
      <!-- Consola activa -->
      <div class="flex items-center space-x-2">
        <input 
          type="checkbox" 
          id="consoleEnabled" 
          v-model="consoleEnabled"
          @change="onConsoleToggle"
          class="rounded"
        />
        <label for="consoleEnabled" class="text-gray-300 text-sm">Consola Activa</label>
      </div>
      
      <!-- Storage activo -->
      <div class="flex items-center space-x-2">
        <input 
          type="checkbox" 
          id="storageEnabled" 
          v-model="storageEnabled"
          @change="onStorageToggle"
          class="rounded"
        />
        <label for="storageEnabled" class="text-gray-300 text-sm">Guardar en Storage</label>
      </div>
      
      <!-- Acciones -->
      <div class="flex space-x-2">
        <button 
          @click="exportLogs"
          class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm px-2 py-1 rounded transition-colors"
        >
          Exportar
        </button>
        <button 
          @click="clearLogs"
          class="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm px-2 py-1 rounded transition-colors"
        >
          Limpiar
        </button>
      </div>
      
      <!-- Contador de logs -->
      <div class="text-gray-400 text-xs">
        <div>Logs en storage: {{ logCount }}</div>
        <div v-if="lastLogTime">Último log: {{ formatTime(lastLogTime) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { logger, LogLevel } from '../lib/utils/logger';
import MaterialIcon from './MaterialIcon.vue';

const isExpanded = ref(false);
const currentLevel = ref<LogLevel>(logger.getLevel());
const consoleEnabled = ref(true);
const storageEnabled = ref(false);
const logCount = ref(0);
const lastLogTime = ref<number | null>(null);

let updateInterval: NodeJS.Timeout;

onMounted(() => {
  // Actualizar estado inicial
  updateLogInfo();
  
  // Actualizar cada 2 segundos
  updateInterval = setInterval(updateLogInfo, 2000);
});

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

function updateLogInfo() {
  const logs = logger.getLogs();
  logCount.value = logs.length;
  if (logs.length > 0) {
    lastLogTime.value = logs[logs.length - 1].timestamp;
  }
}

function togglePanel() {
  isExpanded.value = !isExpanded.value;
}

function onLevelChange() {
  logger.setLevel(currentLevel.value);
}

function onConsoleToggle() {
  logger.configure({
    enableConsole: consoleEnabled.value
  });
}

function onStorageToggle() {
  logger.configure({
    enableStorage: storageEnabled.value
  });
}

function exportLogs() {
  const logs = logger.exportLogs();
  const blob = new Blob([logs], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `webrtc-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function clearLogs() {
  logger.clearLogs();
  logCount.value = 0;
  lastLogTime.value = null;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}
</script>

<style scoped>
/* Estilos adicionales si son necesarios */
</style>
