<template>
  <div class="unified-video-grid w-full h-full">
    <!-- Grid principal -->
    <div 
      ref="gridContainer"
      class="video-grid-container w-full h-full"
      :class="getContainerClasses()"
      :style="containerStyles"
    >
      <template v-if="focusedVideoId">
        <!-- Video enfocado al 100% -->
        <VideoItem 
          :video="displayVideos[0]" 
          :key="displayVideos[0].id"
          :index="0"
          :config="config"
          :itemClasses="getItemClasses(displayVideos[0], 0)"
          :itemStyles="{ width: '100%', height: '100%' }"
          :videoState="getVideoState(displayVideos[0], 0)"
          @click="handleVideoClick(displayVideos[0], 0)"
          @mouseenter="handleMouseEnter(displayVideos[0], 0)"
          @mouseleave="handleMouseLeave(displayVideos[0], 0)"
        >
          <template #video="{ video, index, config, isActive, isFocused, isMain }">
            <slot 
              name="video" 
              :video="video" 
              :index="index" 
              :config="config"
              :isActive="isActive"
              :isFocused="isFocused"
              :isMain="isMain"
            />
          </template>
        </VideoItem>
        <!-- Fila de videos pequeños superpuesta -->
        <div ref="smallRow" class="small-videos-row">
          <VideoItem 
            v-for="(video, index) in displayVideos.slice(1)" 
            :key="video.id"
            :video="video"
            :index="index + 1"
            :config="config"
            :itemClasses="getItemClasses(video, index + 1)"
            :itemStyles="{ flex: '0 0 150px', height: '100%' }"
            :videoState="getVideoState(video, index + 1)"
            @click="handleVideoClick(video, index + 1)"
            @mouseenter="handleMouseEnter(video, index + 1)"
            @mouseleave="handleMouseLeave(video, index + 1)"
          >
            <template #video="{ video, index, config, isActive, isFocused, isMain }">
              <slot 
                name="video" 
                :video="video" 
                :index="index" 
                :config="config"
                :isActive="isActive"
                :isFocused="isFocused"
                :isMain="isMain"
              />
            </template>
          </VideoItem>
        </div>
      </template>
      <template v-else>
        <VideoItem 
          v-for="(video, index) in displayVideos" 
          :key="video.id"
          :video="video"
          :index="index"
          :config="config"
          :itemClasses="getItemClasses(video, index)"
          :itemStyles="getItemStyles(video, index)"
          :videoState="getVideoState(video, index)"
          @click="handleVideoClick(video, index)"
          @mouseenter="handleMouseEnter(video, index)"
          @mouseleave="handleMouseLeave(video, index)"
        >
          <template #video="{ video, index, config, isActive, isFocused, isMain }">
            <slot 
              name="video" 
              :video="video" 
              :index="index" 
              :config="config"
              :isActive="isActive"
              :isFocused="isFocused"
              :isMain="isMain"
            />
          </template>
        </VideoItem>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import VideoItem from './VideoItem.vue'

// Tipos de configuración simplificados
interface GridConfig {
  modes: Record<string, Record<string, any>>
  colors?: string[]
  defaultMode?: string
}

interface Props {
  videos?: string[]
  config: GridConfig
}

const props = withDefaults(defineProps<Props>(), {
  videos: () => ['Local', 'User1', 'User2', 'User3']
})

// Referencias del DOM
const gridContainer = ref<HTMLElement | null>(null)
const videoItems = ref<HTMLElement[]>([])

// Estado reactivo
const currentMode = ref<string>(props.config.defaultMode || 'auto')
const previousMode = ref<string>('')
const videoOrder = ref<string[]>([])
const focusedVideoId = ref<string | null>(null)
const mainVideoId = ref<string | null>(null)
const perspectiveEnabled = ref(false)

// Colores por defecto
const defaultColors = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
  '#E11D48', '#7C3AED', '#059669', '#DC2626', '#2563EB', '#CA8A04'
]

// Computed properties
const videoCount = computed(() => props.videos.length)

const videoColors = computed(() => {
  return props.config.colors || defaultColors;
})

const availableModes = computed(() => {
  return Object.keys(props.config.modes || {})
})

const supportsPerspective = computed(() => {
  return Object.keys(props.config.modes || {}).includes('transform')
})

const displayVideos = computed(() => {
  return videoOrder.value.map((videoId, index) => {
    const baseVideo = {
      id: videoId,
      color: videoColors.value[index % videoColors.value.length],
      visible: true
    }

    // Agregar propiedades específicas según el modo actual
    const hasFocus = availableModes.value.includes('focus')
    const hasMain = availableModes.value.includes('MainSidebar')

    if (hasFocus) {
      return {
        ...baseVideo,
        focused: focusedVideoId.value === videoId
      }
    } else if (hasMain) {
      return {
        ...baseVideo,
        main: mainVideoId.value === videoId
      }
    }

    return baseVideo
  })
})

const containerStyles = computed(() => {
  const baseStyles: any = {
    minHeight: '400px',
    position: 'relative'
  }

  if (focusedVideoId.value) {
    return {
      ...baseStyles,
      display: 'block',
      padding: '0'
    }
  }

  if (availableModes.value.includes('auto')) {
    return getGridStyles(baseStyles)
  } else if (availableModes.value.includes('equal')) {
    return getFlexboxStyles(baseStyles)
  } else if (availableModes.value.includes('viewport')) {
    return getMixedStyles(baseStyles)
  }

  return baseStyles
})

const gridState = computed(() => ({
  videoCount: videoCount.value,
  currentMode: currentMode.value,
  focusedVideoId: focusedVideoId.value,
  mainVideoId: mainVideoId.value,
  perspectiveEnabled: perspectiveEnabled.value,
  technique: getCurrentTechnique()
}))

// Métodos de control expuestos
const controlMethods = {
  setMode,
  shuffleVideos,
  togglePerspective,
  resetGrid,
  focusVideo: (videoId: string) => {
    focusedVideoId.value = videoId
  },
  setMainVideo: (videoId: string) => {
    mainVideoId.value = videoId
  }
}

// Funciones principales
function initializeVideos() {
  videoOrder.value = [...props.videos]
}

function setMode(mode: string) {
  currentMode.value = mode
  
  // Lógica específica según los modos disponibles
  const modes = availableModes.value
  if (modes.includes('focus') && mode === 'focus' && !focusedVideoId.value && videoOrder.value.length > 0) {
    focusedVideoId.value = videoOrder.value[0]
  } else if (modes.includes('focus') && mode === 'auto') {
    focusedVideoId.value = null
  }
  
  if (modes.includes('MainSidebar') && mode === 'MainSidebar' && !mainVideoId.value && videoOrder.value.length > 0) {
    mainVideoId.value = videoOrder.value[0]
  } else if (modes.includes('MainSidebar') && mode === 'equal') {
    mainVideoId.value = null
  }
}

function handleVideoClick(video: any, index: number) {
  if (focusedVideoId.value === video.id) {
    focusedVideoId.value = null;
    if (previousMode.value) {
      setMode(previousMode.value);
      previousMode.value = '';
    }
  } else {
    if (!focusedVideoId.value) {
      previousMode.value = currentMode.value;
    }
    focusedVideoId.value = video.id;
    const videoIndex = videoOrder.value.indexOf(video.id);
    if (videoIndex > 0) {
      videoOrder.value.splice(videoIndex, 1);
      videoOrder.value.unshift(video.id);
    }
    setMode('focus');
  }
  mainVideoId.value = focusedVideoId.value;
}

function shuffleVideos() {
  const shuffled = [...videoOrder.value]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  videoOrder.value = shuffled
}


function togglePerspective() {
  if (!supportsPerspective.value) return
  perspectiveEnabled.value = !perspectiveEnabled.value
}

function resetGrid() {
  initializeVideos()
  currentMode.value = props.config.defaultMode || availableModes.value[0] || 'auto'
  focusedVideoId.value = null
  mainVideoId.value = null
  perspectiveEnabled.value = false
}

// Funciones de estilo específicas
function getGridStyles(baseStyles: any) {
  const count = videoCount.value
  
  if (currentMode.value === 'focus' && focusedVideoId.value && count > 1) {
    return {
      ...baseStyles,
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gridTemplateRows: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '12px'
    }
  }
  
  // Cálculo automático de grid
  let cols = 1, rows = 1
  if (count === 2) { cols = 2; rows = 1 }
  else if (count <= 4) { cols = 2; rows = 2 }
  else if (count <= 6) { cols = 3; rows = 2 }
  else if (count <= 9) { cols = 3; rows = 3 }
  else if (count <= 12) { cols = 4; rows = 3 }
  else if (count <= 16) { cols = 4; rows = 4 }
  else {
    cols = Math.ceil(Math.sqrt(count))
    rows = Math.ceil(count / cols)
  }
  
  return {
    ...baseStyles,
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gap: '12px'
  }
}

function getFlexboxStyles(baseStyles: any) {
  if (currentMode.value === 'focus' && focusedVideoId.value) {
    return {
      ...baseStyles,
      display: 'block',
      padding: '0'
    }
  } else if (currentMode.value === 'MainSidebar') {
    return {
      ...baseStyles,
      display: 'flex',
      gap: '16px'
    }
  } else if (currentMode.value === 'masonry') {
    return {
      ...baseStyles,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px'
    }
  }
  
  // Layout igual por defecto
  return {
    ...baseStyles,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px'
  }
}

function getMixedStyles(baseStyles: any) {
if (currentMode.value === 'viewport') {
    return {
      ...baseStyles,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      justifyContent: 'space-around',
      alignItems: 'flex-start'
    }
  } else if (currentMode.value === 'intersection') {
    return {
      ...baseStyles,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '12px',
      maxHeight: '600px',
      overflowY: 'auto'
    }
  }
  
  return baseStyles
}

// Funciones auxiliares
function getContainerClasses() {
  const classes = [`mode-${currentMode.value}`]
  
  if (perspectiveEnabled.value) classes.push('perspective-enabled')
  
  return classes
}

function getItemClasses(video: any, index: number) {
  const classes = ['video-item-base']
  
  const modes = availableModes.value
  
  if (modes.includes('focus') && currentMode.value === 'focus' && video.focused) {
    classes.push('focused-video')
  }
  
  if (modes.includes('MainSidebar') && currentMode.value === 'MainSidebar' && video.main) {
    classes.push('main-video')
  }
  
  if (modes.includes('masonry') && currentMode.value === 'masonry') {
    classes.push(`masonry-item-${(index % 3) + 1}`)
  }
  
  return classes
}

function getItemStyles(video: any, index: number) {
  const styles: any = {}
  
  const modes = availableModes.value
  
  if (modes.includes('equal') && currentMode.value === 'equal') {
    styles.flex = '1 1 calc(50% - 8px)'
    styles.minWidth = '250px'
    styles.minHeight = '180px'
  } else if (modes.includes('MainSidebar') && currentMode.value === 'MainSidebar') {
    if (video.main) {
      styles.flex = '2'
      styles.minHeight = '300px'
    } else {
      styles.flex = '0 0 200px'
      styles.minHeight = '120px'
    }
  } else if (modes.includes('masonry') && currentMode.value === 'masonry') {
    styles.flex = '1 1 calc(33.333% - 8px)'
    styles.minWidth = '200px'
    const heights = ['200px', '150px', '250px']
    styles.minHeight = heights[index % 3]
  } else if (modes.includes('viewport') && currentMode.value === 'viewport') {
    const vw = window.innerWidth
    const vh = window.innerHeight
    styles.width = vw > 768 ? '200px' : '150px'
    styles.height = vh > 600 ? '150px' : '120px'
  }
  
  return styles
}

function getVideoState(video: any, index: number) {
  return {
    isActive: index === 0,
    isFocused: video.focused || false,
    isMain: video.main || false
  }
}

function getCurrentTechnique() {
  const modes = availableModes.value
  if (modes.includes('auto') || modes.includes('focus')) return 'CSS Grid'
  if (modes.includes('equal') || modes.includes('MainSidebar') || modes.includes('masonry')) return 'Flexbox'
  if (modes.includes('viewport') || modes.includes('intersection')) {
    switch (currentMode.value) {
      case 'viewport': return 'Viewport Units'
      case 'intersection': return 'Intersection Observer'
      default: return 'Mixed'
    }
  }
  return 'Unknown'
}

function handleMouseEnter(video: any, index: number) {
  const modes = availableModes.value
  if (modes.includes('viewport') && currentMode.value === 'viewport') {
    const item = videoItems.value[index]
    if (item) {
      item.style.transform = 'translateY(-10px) scale(1.05)'
      item.style.transition = 'transform 0.3s ease'
    }
  }
}

function handleMouseLeave(video: any, index: number) {
  const modes = availableModes.value
  if (modes.includes('viewport') && currentMode.value === 'viewport') {
    const item = videoItems.value[index]
    if (item) {
      item.style.transform = ''
    }
  }
}

// Funciones específicas para mixed mode
function getVideoRotation(index: number) {
  return (index * 15) % 360
}

function getVideoScale(index: number) {
  const scales = [1.0, 1.1, 0.9, 1.05]
  return scales[index % scales.length]
}



// Watchers
watch(
  () => props.videos,
  () => {
    initializeVideos()
  },
  { immediate: true }
)

watch(
  () => props.config,
  () => {
    resetGrid()
  },
  { deep: true }
)

// Lifecycle
onMounted(() => {
  initializeVideos()
})

// Exponer métodos para control externo
defineExpose({
  setMode,
  shuffleVideos,
  focusVideo: (videoId: string) => { focusedVideoId.value = videoId },
  setMainVideo: (videoId: string) => { mainVideoId.value = videoId },
  getState: () => gridState.value
})
</script>

<style scoped>
/* Variables CSS para temas */
:root {
  --bg-primary: #f8fafc;
  --bg-secondary: #ffffff;
  --text-primary: #374151;
  --border-color: #e5e7eb;
  --bg-mixed: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  --bg-mixed-overlay: rgba(255, 255, 255, 0.05);
  --border-mixed: rgba(255, 255, 255, 0.1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1a1a1a;
    --bg-secondary: #111827;
    --text-primary: #d1d5db;
    --border-color: #374151;
  }
}

/* Estilos base */
.unified-video-grid {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* Grid container */
.video-grid-container {
  width: 100%;
  border-radius: 12px;
  padding: 16px;
  position: relative;
  z-index: 1;
  transition: all 0.5s ease;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

/* Modo mixed especial */
.grid-type-mixed .unified-video-grid {
  background: var(--bg-mixed);
  color: white;
}

.grid-type-mixed .unified-video-grid::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at 30% 70%, rgba(231, 76, 60, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 70% 30%, rgba(52, 152, 219, 0.1) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

.grid-type-mixed .video-grid-container {
  background: var(--bg-mixed-overlay);
  backdrop-filter: blur(15px);
  border: 1px solid var(--border-mixed);
}

/* Estilos específicos por tipo */
.grid-type-grid .focused-video {
  grid-column: 1;
  grid-row: 1 / -1;
}

.grid-type-flexbox .main-video {
  flex: 2 !important;
  min-height: 300px !important;
}

.grid-type-flexbox .masonry-item-1 { min-height: 200px; }
.grid-type-flexbox .masonry-item-2 { min-height: 150px; }
.grid-type-flexbox .masonry-item-3 { min-height: 250px; }

.grid-type-mixed.mode-transform .video-item {
  border-color: rgba(231, 76, 60, 0.5);
}

.grid-type-mixed.mode-viewport .video-item {
  border-color: rgba(52, 152, 219, 0.5);
}

.perspective-enabled .video-item {
  perspective: 1000px;
}

/* Responsive */
@media (max-width: 768px) {
  .unified-video-grid {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .video-grid-container {
    padding: 12px;
  }
}

/* Estilos para modo focus */
.small-videos-row {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 200px;
  display: flex;
  overflow-x: auto;
  gap: 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.5);
  box-sizing: border-box;
}

</style>