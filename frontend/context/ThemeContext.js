'use client';

/**
 * CipherVault — Theme Provider
 * Manages multiple eye-soothing themes with CSS variable switching.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const THEMES = {
  midnight: {
    name: 'Midnight',
    emoji: '🌙',
    desc: 'Deep dark blue',
    colors: {
      '--bg-primary': '#020617',
      '--bg-secondary': '#0f172a',
      '--bg-card': 'rgba(255,255,255,0.05)',
      '--bg-card-hover': 'rgba(255,255,255,0.10)',
      '--border-primary': 'rgba(255,255,255,0.10)',
      '--border-hover': 'rgba(255,255,255,0.20)',
      '--text-primary': '#f8fafc',
      '--text-secondary': '#cbd5e1',
      '--text-muted': '#94a3b8',
      '--text-dim': '#64748b',
      '--scrollbar-track': '#0f172a',
      '--scrollbar-thumb': '#334155',
      '--grid-color': 'rgba(99, 102, 241, 0.03)',
      '--glow-color': 'rgba(99, 102, 241, 0.25)',
      '--hero-glow': 'rgba(99, 102, 241, 0.15)',
      '--brand-primary': '#6366f1',
      '--brand-light': '#818cf8',
      '--brand-dark': '#4f46e5',
    },
  },
  ocean: {
    name: 'Ocean Deep',
    emoji: '🌊',
    desc: 'Calming deep teal',
    colors: {
      '--bg-primary': '#021a1a',
      '--bg-secondary': '#0a2f2f',
      '--bg-card': 'rgba(0,255,220,0.04)',
      '--bg-card-hover': 'rgba(0,255,220,0.08)',
      '--border-primary': 'rgba(0,255,220,0.10)',
      '--border-hover': 'rgba(0,255,220,0.20)',
      '--text-primary': '#e0fef6',
      '--text-secondary': '#a7d8cc',
      '--text-muted': '#6bb5a0',
      '--text-dim': '#4d9080',
      '--scrollbar-track': '#0a2f2f',
      '--scrollbar-thumb': '#1a5050',
      '--grid-color': 'rgba(6, 182, 212, 0.03)',
      '--glow-color': 'rgba(6, 182, 212, 0.25)',
      '--hero-glow': 'rgba(6, 182, 212, 0.15)',
      '--brand-primary': '#06b6d4',
      '--brand-light': '#22d3ee',
      '--brand-dark': '#0891b2',
    },
  },
  forest: {
    name: 'Forest',
    emoji: '🌲',
    desc: 'Natural green calm',
    colors: {
      '--bg-primary': '#021209',
      '--bg-secondary': '#0a261a',
      '--bg-card': 'rgba(16,185,129,0.04)',
      '--bg-card-hover': 'rgba(16,185,129,0.08)',
      '--border-primary': 'rgba(16,185,129,0.10)',
      '--border-hover': 'rgba(16,185,129,0.20)',
      '--text-primary': '#ecfdf5',
      '--text-secondary': '#a7d7be',
      '--text-muted': '#6bb592',
      '--text-dim': '#4d9070',
      '--scrollbar-track': '#0a261a',
      '--scrollbar-thumb': '#1a4d35',
      '--grid-color': 'rgba(16, 185, 129, 0.03)',
      '--glow-color': 'rgba(16, 185, 129, 0.25)',
      '--hero-glow': 'rgba(16, 185, 129, 0.15)',
      '--brand-primary': '#10b981',
      '--brand-light': '#34d399',
      '--brand-dark': '#059669',
    },
  },
  sunset: {
    name: 'Sunset',
    emoji: '🌅',
    desc: 'Warm amber glow',
    colors: {
      '--bg-primary': '#0c0704',
      '--bg-secondary': '#1c150e',
      '--bg-card': 'rgba(245,158,11,0.04)',
      '--bg-card-hover': 'rgba(245,158,11,0.08)',
      '--border-primary': 'rgba(245,158,11,0.10)',
      '--border-hover': 'rgba(245,158,11,0.20)',
      '--text-primary': '#fef3c7',
      '--text-secondary': '#d4b483',
      '--text-muted': '#ab8a5c',
      '--text-dim': '#8a6f47',
      '--scrollbar-track': '#1c150e',
      '--scrollbar-thumb': '#3d2e1a',
      '--grid-color': 'rgba(245, 158, 11, 0.03)',
      '--glow-color': 'rgba(245, 158, 11, 0.25)',
      '--hero-glow': 'rgba(245, 158, 11, 0.15)',
      '--brand-primary': '#f59e0b',
      '--brand-light': '#fbbf24',
      '--brand-dark': '#d97706',
    },
  },
  light: {
    name: 'Light',
    emoji: '☀️',
    desc: 'Clean bright white',
    colors: {
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f8fafc',
      '--bg-card': 'rgba(99,102,241,0.05)',
      '--bg-card-hover': 'rgba(99,102,241,0.08)',
      '--border-primary': 'rgba(0,0,0,0.08)',
      '--border-hover': 'rgba(0,0,0,0.15)',
      '--text-primary': '#0f172a',
      '--text-secondary': '#334155',
      '--text-muted': '#64748b',
      '--text-dim': '#94a3b8',
      '--scrollbar-track': '#f1f5f9',
      '--scrollbar-thumb': '#cbd5e1',
      '--grid-color': 'rgba(99, 102, 241, 0.04)',
      '--glow-color': 'rgba(99, 102, 241, 0.15)',
      '--hero-glow': 'rgba(99, 102, 241, 0.08)',
      '--brand-primary': '#6366f1',
      '--brand-light': '#818cf8',
      '--brand-dark': '#4f46e5',
    },
  },
  lavender: {
    name: 'Lavender',
    emoji: '💜',
    desc: 'Soft purple light',
    colors: {
      '--bg-primary': '#faf7ff',
      '--bg-secondary': '#f3ecff',
      '--bg-card': 'rgba(139,92,246,0.07)',
      '--bg-card-hover': 'rgba(139,92,246,0.12)',
      '--border-primary': 'rgba(139,92,246,0.15)',
      '--border-hover': 'rgba(139,92,246,0.28)',
      '--text-primary': '#1e1b4b',
      '--text-secondary': '#3b3270',
      '--text-muted': '#6d60a8',
      '--text-dim': '#9d93c8',
      '--scrollbar-track': '#f0e8ff',
      '--scrollbar-thumb': '#c4b5fd',
      '--grid-color': 'rgba(139, 92, 246, 0.04)',
      '--glow-color': 'rgba(139, 92, 246, 0.18)',
      '--hero-glow': 'rgba(139, 92, 246, 0.08)',
      '--brand-primary': '#8b5cf6',
      '--brand-light': '#a78bfa',
      '--brand-dark': '#7c3aed',
    },
  },
  arctic: {
    name: 'Arctic',
    emoji: '❄️',
    desc: 'Clean ice blue',
    colors: {
      '--bg-primary': '#f0f9ff',
      '--bg-secondary': '#e0f2fe',
      '--bg-card': 'rgba(14,165,233,0.06)',
      '--bg-card-hover': 'rgba(14,165,233,0.11)',
      '--border-primary': 'rgba(14,165,233,0.14)',
      '--border-hover': 'rgba(14,165,233,0.26)',
      '--text-primary': '#0c2d48',
      '--text-secondary': '#155e8a',
      '--text-muted': '#3a82ad',
      '--text-dim': '#7ab4d4',
      '--scrollbar-track': '#e0f2fe',
      '--scrollbar-thumb': '#7dd3fc',
      '--grid-color': 'rgba(14, 165, 233, 0.04)',
      '--glow-color': 'rgba(14, 165, 233, 0.18)',
      '--hero-glow': 'rgba(14, 165, 233, 0.08)',
      '--brand-primary': '#0ea5e9',
      '--brand-light': '#38bdf8',
      '--brand-dark': '#0284c7',
    },
  },
  rose: {
    name: 'Rose',
    emoji: '🌸',
    desc: 'Warm pink light',
    colors: {
      '--bg-primary': '#fff5f7',
      '--bg-secondary': '#ffe4e8',
      '--bg-card': 'rgba(244,63,94,0.05)',
      '--bg-card-hover': 'rgba(244,63,94,0.09)',
      '--border-primary': 'rgba(244,63,94,0.12)',
      '--border-hover': 'rgba(244,63,94,0.22)',
      '--text-primary': '#1c1017',
      '--text-secondary': '#6b2138',
      '--text-muted': '#9f4060',
      '--text-dim': '#d4809a',
      '--scrollbar-track': '#ffe4e8',
      '--scrollbar-thumb': '#fda4af',
      '--grid-color': 'rgba(244, 63, 94, 0.03)',
      '--glow-color': 'rgba(244, 63, 94, 0.18)',
      '--hero-glow': 'rgba(244, 63, 94, 0.08)',
      '--brand-primary': '#f43f5e',
      '--brand-light': '#fb7185',
      '--brand-dark': '#e11d48',
    },
  },
};

const THEME_STORAGE_KEY = 'cv_theme';
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState('midnight');

  // Load saved theme
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && THEMES[saved]) {
      setThemeName(saved);
      applyTheme(saved);
    }
  }, []);

  const applyTheme = useCallback((name) => {
    const theme = THEMES[name];
    if (!theme) return;
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.setAttribute('data-theme', name);
  }, []);

  const setTheme = useCallback((name) => {
    if (!THEMES[name]) return;
    setThemeName(name);
    applyTheme(name);
    localStorage.setItem(THEME_STORAGE_KEY, name);
  }, [applyTheme]);

  const isLightTheme = ['light', 'lavender', 'arctic', 'rose'].includes(themeName);

  return (
    <ThemeContext.Provider value={{ themeName, setTheme, themes: THEMES, isLightTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}

export { THEMES };
