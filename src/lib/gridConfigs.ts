// Configuraciones predefinidas para UnifiedVideoGrid

export interface GridConfig {
  modes: Record<string, Record<string, any>>
  colors?: string[]
  defaultMode?: string
}

// Configuración para Grid CSS
export const gridConfig: GridConfig = {
  modes: {
    auto: {},
    focus: {}
  },
  colors: [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
    '#F97316', '#6366F1', '#14B8A6', '#F43F5E'
  ],
  defaultMode: 'auto'
}

// Configuración para Flexbox
export const flexboxConfig: GridConfig = {
  modes: {
    equal: {},
    focus: {},
    MainSidebar: {},
    masonry: {}
  },
  colors: [
    '#E11D48', '#7C3AED', '#059669', '#DC2626',
    '#2563EB', '#CA8A04', '#9333EA', '#0891B2',
    '#EA580C', '#4338CA', '#0D9488', '#BE185D'
  ],
  defaultMode: 'masonry'
}

// Configuración para Mixed (Avanzado)
export const mixedConfig: GridConfig = {
  modes: {
    viewport: {},
    intersection: {}
  },
  colors: [
    '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
    '#9B59B6', '#1ABC9C', '#34495E', '#E67E22',
    '#95A5A6', '#F1C40F', '#8E44AD', '#16A085'
  ],
  defaultMode: 'viewport'
}

// Configuración minimalista
export const minimalConfig: GridConfig = {
  modes: {
    auto: {}
  },
  defaultMode: 'auto'
}

// Configuración personalizable
export const customConfig: GridConfig = {
  modes: {
    equal: {},
    MainSidebar: {}
  },
  colors: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
  ],
  defaultMode: 'equal'
}

// Función helper para crear configuraciones personalizadas
export function createGridConfig(overrides: Partial<GridConfig>): GridConfig {
  const baseConfig = {
    modes: {
      auto: {}
    },
    defaultMode: 'auto'
  }

  return {
    ...baseConfig,
    ...overrides,
    modes: {
      ...baseConfig.modes,
      ...overrides.modes
    }
  }
}

// Configuraciones de ejemplo para diferentes casos de uso
export const presetConfigs = {
  // Para videoconferencias básicas
  videoCall: createGridConfig({
    modes: {
      auto: {},
      focus: {}
    }
  }),

  // Para presentaciones
  presentation: createGridConfig({
    modes: {
      MainSidebar: {},
      equal: {}
    },
    defaultMode: 'MainSidebar'
  }),

  // Para demos técnicas
  techDemo: createGridConfig({
    modes: {
      viewport: {},
      intersection: {}
    }
  }),

  // Para aplicaciones móviles
  mobile: createGridConfig({
    modes: {
      equal: {},
      MainSidebar: {}
    },
    colors: [
      '#007AFF', '#FF3B30', '#34C759', '#FF9500',
      '#AF52DE', '#FF2D92', '#5AC8FA', '#FFCC00'
    ]
  })
}

export default {
  gridConfig,
  flexboxConfig,
  mixedConfig,
  minimalConfig,
  customConfig,
  createGridConfig,
  presetConfigs
}