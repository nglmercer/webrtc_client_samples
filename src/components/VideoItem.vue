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
        <div class="video-info">
          <span>{{ video.id }}</span>
        </div>
      </div>
    </slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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
</style>