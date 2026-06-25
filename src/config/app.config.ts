import type { AppConfig } from './types';
import { getApiUrl } from './env';

export const appConfig: AppConfig = {
  api: {
    baseUrl: getApiUrl(),
    version: 'v1',
    timeout: 15000,
    retryAttempts: 3,
  },

  app: {
    name: 'Keystorm',
    title: 'Keystorm — A typing roguelite',
    description:
      'A bilingual (English & Arabic) typing roguelite where getting better at typing is the fun.',
    version: '1.0.0',
    author: 'Keystorm',
    url: 'https://example.com',
    language: 'en',
  },

  theme: {
    defaultTheme: 'system',
    light: {
      primary: '#0f766e',
      secondary: '#7e22ce',
      accent: '#a16207',
      background: '#faf3e0',
      surface: '#fffaf0',
      surfaceElevated: '#ffffff',
      text: '#2b2521',
      textSecondary: '#6f6155',
      border: '#3a322c',
      muted: '#efe4cc',
      glow: '#eab308',
      link: '#0f766e',
      linkHover: '#0b5f57',
      emphasis: '#0b5f57',
      success: '#15803d',
      warning: '#b45309',
      error: '#c4332b',
      info: '#0f766e',
    },
    dark: {
      primary: '#2dd4bf',
      secondary: '#c084fc',
      accent: '#fbbf24',
      background: '#1c1917',
      surface: '#292320',
      surfaceElevated: '#352d26',
      text: '#f5ecdd',
      textSecondary: '#b3a48f',
      border: '#5c5046',
      muted: '#292320',
      glow: '#fbbf24',
      link: '#2dd4bf',
      linkHover: '#5eead4',
      emphasis: '#2dd4bf',
      success: '#4ade80',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#2dd4bf',
    },
  },

  typography: {
    fonts: [
      {
        name: 'IBM Plex Sans',
        src: '/font/IBMPlexSansArabic-Regular.ttf',
        weight: 400,
        style: 'normal',
        display: 'swap',
        preload: true,
      },
    ],
    primary: {
      family: 'IBM Plex Sans',
      fallbacks: [
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'sans-serif',
      ],
      cssVariable: 'font-primary',
    },
    secondary: {
      family: 'Georgia',
      fallbacks: ['Times New Roman', 'serif'],
      cssVariable: 'font-secondary',
    },
    mono: {
      family: 'Fira Code',
      fallbacks: ['Courier New', 'Courier', 'monospace'],
      cssVariable: 'font-mono',
    },
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    weights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  icons: {
    favicon: '/vite.svg',
    sizes: ['192x192', '512x512'],
  },

  seo: {
    title: 'Keystorm — A typing roguelite',
    description:
      'A bilingual (English & Arabic) typing roguelite where getting better at typing is the fun.',
    keywords: ['typing', 'roguelite', 'arabic', 'english', 'wpm', 'game'],
    robots: 'index, follow',
    openGraph: {
      siteName: 'Keystorm',
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
    },
  },

  layout: {
    containerMaxWidth: '1280px',
    spacing: {
      xs: '0.5rem',
      sm: '1rem',
      md: '1.5rem',
      lg: '2rem',
      xl: '3rem',
      '2xl': '4rem',
    },
  },
};
