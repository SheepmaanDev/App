import { Platform } from 'react-native';

/**
 * Palette sombre « console auto-hebergee ».
 */
export const colors = {
  background: '#0B0E14',
  surface: '#141924',
  surfaceAlt: '#1A2130',
  border: '#232C3B',
  text: '#E6E9EF',
  textSecondary: '#8B95A7',
  textMuted: '#5C6676',
  accent: '#35E08A',
  accentDim: 'rgba(53, 224, 138, 0.12)',
  danger: '#FF5C5C',
  dangerDim: 'rgba(255, 92, 92, 0.12)',
  warning: '#F5B15F',
  info: '#5BB0FF',

  // Etats Docker
  stateRunning: '#35E08A',
  stateExited: '#8B95A7',
  statePaused: '#F5B15F',
  stateRestarting: '#5BB0FF',
  stateCreated: '#C68BFF',
  stateDead: '#FF5C5C',
  stateRemoving: '#8B95A7'
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20
} as const;

export const fonts = {
  regular: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: 'system-ui, sans-serif'
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    web: 'ui-monospace, Menlo, monospace'
  })
};

export const shadows = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6
  },
  android: { elevation: 3 },
  default: undefined
});