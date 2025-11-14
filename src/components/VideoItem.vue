<template>
  <div
    class="video-item"
    :class="getItemClasses"
    :style="getItemStyles"
    @click="$emit('click', video, index)"
    @mouseenter="$emit('mouseenter', video, index)"
    @mouseleave="$emit('mouseleave', video, index)"
  >
    <slot
      name="video"
      :video="video"
      :index="index"
      :config="config"
      :isActive="isActive"
      :isFocused="isFocused"
      :isMain="isMain"
    >
      <div class="default-video-content">
        <div
          class="video-display"
          :style="{ backgroundColor: video.color }"
        >
          <span class="video-label">{{ video.id }}</span>
        </div>
        
        <!-- Controles minimizables -->
        <div class="video-controls-container">
          <!-- Icono para mostrar/ocultar controles -->
          <button 
            class="controls-toggle-btn"
            @click.stop="toggleControls"
            :title="areControlsVisible ? 'Ocultar controles' : 'Mostrar controles'"
          >
            <svg class="controls-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2 2 .9 2 2 .9 2 2 2-.9 2-2zm0 2c6.63 0 12 5.37 12 12s-5.37 12-12-12-5.37-12-12-12zm-2 15l-2-2 7-7 7 7-2z"/>
            </svg>
          </button>
          
          <!-- Panel de controles -->
          <transition name="controls-fade">
            <div v-show="areControlsVisible" class="video-controls">
              <div class="video-info">
                <div class="flex items-center space-x-2">
                  <span class="font-medium">
                    {{ video.id }}
                  </span>
                  <!-- Indicadores de estado -->
                  <div class="flex space-x-1">
                    <span v-if="isMain" class="text-blue-400">👑</span>
                    <span v-if="isFocused" class="text-yellow-400">⭐</span>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
      </div>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  video: any
  index: number
  config: any
  itemClasses: string[]
  itemStyles: any
  videoState: { isActive: boolean; isFocused: boolean; isMain: boolean }
}

const props = defineProps<Props>()

defineEmits(['click', 'mouseenter', 'mouseleave'])

// Estado reactivo para los controles
const areControlsVisible = ref(false)

// Toggle para mostrar/ocultar controles
function toggleControls() {
  areControlsVisible.value = !areControlsVisible.value
}

const getItemClasses = computed(() => props.itemClasses)
const getItemStyles = computed(() => props.itemStyles)
const isActive = computed(() => props.videoState.isActive)
const isFocused = computed(() => props.videoState.isFocused)
const isMain = computed(() => props.videoState.isMain)
</script>

<style scoped>
/* Estilos extraídos para video-item */
.video-item {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 150px;
}

/* Añadir otros estilos relevantes de .video-item del original */
.theme-dark .video-item {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.theme-light .video-item {
  background: #ffffff;
  border: 2px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.theme-mixed .video-item {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  transform-style: preserve-3d;
}

.video-item:hover {
  transform: translateY(-4px) scale(1.02);
}

/* Añadir más estilos según sea necesario */

.default-video-content {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 150px;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.video-display {
  width: 100%;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 140px;
  position: relative;
  overflow: hidden;
}

.video-label {
  font-size: 18px;
  font-weight: bold;
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.7);
  z-index: 2;
  position: relative;
}

.video-info {
  padding: 12px;
  background: rgba(0, 0, 0, 0.4);
  color: white;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
}

/* Estilos para controles minimizables */
.video-controls-container {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
}

.controls-toggle-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 11;
  backdrop-filter: blur(4px);
}

.controls-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: scale(1.1);
}

.controls-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.video-controls {
  width: 100%;
  transform-origin: bottom;
}

.controls-fade-enter-active,
.controls-fade-leave-active {
  transition: all 0.3s ease;
}

.controls-fade-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.controls-fade-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.controls-fade-enter-to,
.controls-fade-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* Asegurar que el icono esté siempre visible */
.video-item:hover .controls-toggle-btn {
  background: rgba(0, 0, 0, 0.8);
}
</style>
