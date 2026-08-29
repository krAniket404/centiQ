export interface Theme {
  id: string;
  name: string;
  bg: string;
  accent: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
  glass: string;
  glassStrong: string;
  glassHighlight: string;
  border: string;
  borderStrong: string;
  success: string;
  warning: string;
  danger: string;
  purple: string;
  shadow: string;
}

export const THEMES: { [key: string]: Theme } = {
  azure: {
    id: 'azure',
    name: 'Azure Glass',
    bg: '#060608',
    accent: '#38BDF8',
    secondary: '#E0E0E0',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0B0',
    glass: 'rgba(255,255,255,0.04)',
    glassStrong: 'rgba(255,255,255,0.07)',
    glassHighlight: 'rgba(255,255,255,0.2)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.12)',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    shadow: '#000000',
  },
  emerald: {
    id: 'emerald',
    name: 'Royal Emerald',
    bg: '#040806',
    accent: '#10B981',
    secondary: '#A0B0A0',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0B0A0',
    glass: 'rgba(16,185,129,0.04)',
    glassStrong: 'rgba(16,185,129,0.07)',
    glassHighlight: 'rgba(16,185,129,0.2)',
    border: 'rgba(16,185,129,0.1)',
    borderStrong: 'rgba(16,185,129,0.15)',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    purple: '#A78BFA',
    shadow: '#000000',
  },
  gold: {
    id: 'gold',
    name: 'Midnight Gold',
    bg: '#080704',
    accent: '#FBBF24',
    secondary: '#B0A080',
    textPrimary: '#FFFFFF',
    textSecondary: '#B0A080',
    glass: 'rgba(251,191,36,0.04)',
    glassStrong: 'rgba(251,191,36,0.07)',
    glassHighlight: 'rgba(251,191,36,0.2)',
    border: 'rgba(251,191,36,0.1)',
    borderStrong: 'rgba(251,191,36,0.15)',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    shadow: '#000000',
  },
  amethyst: {
    id: 'amethyst',
    name: 'Amethyst',
    bg: '#070408',
    accent: '#8B5CF6',
    secondary: '#A090B0',
    textPrimary: '#FFFFFF',
    textSecondary: '#A090B0',
    glass: 'rgba(139,92,246,0.04)',
    glassStrong: 'rgba(139,92,246,0.07)',
    glassHighlight: 'rgba(139,92,246,0.2)',
    border: 'rgba(139,92,246,0.1)',
    borderStrong: 'rgba(139,92,246,0.15)',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#C084FC',
    shadow: '#000000',
  }
};
