/**
 * Theme Definitions for Wedding Venue Intelligence Platform
 * 
 * Three core presets + support for custom themes.
 */

export type ThemeName = 'warm-romantic' | 'modern-minimalist' | 'bold-editorial' | 'seven-paths-manor' | 'custom';

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
  border: string;
}

export const themePresets: Record<ThemeName, ThemeColors> = {
  'warm-romantic': {
    primary: '#DCAE96', // Dusty Rose
    secondary: '#8FAF8F', // Sage Green
    background: '#FDFAF4', // Ivory
    surface: '#FFFFFF', // White
    text: '#2C2C2C', // Warm Charcoal
    accent: '#C9A84C', // Champagne Gold
    border: '#E8D5A3', // Pale Champagne
  },
  'modern-minimalist': {
    primary: '#1A1A1A', // Soft Black
    secondary: '#F0F0F0', // Light Gray
    background: '#FFFFFF', // Pure White
    surface: '#FAFAFA', // Off-white
    text: '#333333', // Dark Gray
    accent: '#2563EB', // Royal Blue
    border: '#E5E5E5', // Light Border
  },
  'bold-editorial': {
    primary: '#0A1628', // Deep Navy
    secondary: '#C9A84C', // Gold
    background: '#FDFAF4', // Ivory
    surface: '#FFFFFF', // White
    text: '#111111', // High Contrast Black
    accent: '#DCAE96', // Dusty Rose
    border: '#C9A84C', // Gold Border
  },
  'seven-paths-manor': {
    primary: '#0A1628',
    secondary: '#C9A84C',
    background: '#F5F0E8',
    surface: '#FDFAF4',
    text: '#0A1628',
    accent: '#DCAE96',
    border: '#C9A84C40',
  },
  'custom': {
    primary: '#000000',
    secondary: '#FFFFFF',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#000000',
    accent: '#FFD700',
    border: '#CCCCCC',
  },
};

export const themeTypography = {
  'warm-romantic': {
    display: "'Playfair Display', serif",
    body: "'Inter', sans-serif",
  },
  'modern-minimalist': {
    display: "'Inter', sans-serif",
    body: "'Inter', sans-serif",
  },
  'bold-editorial': {
    display: "'Playfair Display', serif",
    body: "'Inter', sans-serif",
  },
  'seven-paths-manor': {
    display: "'Playfair Display', serif",
    body: "'Inter', sans-serif",
  },
  'custom': {
    display: "'Inter', sans-serif",
    body: "'Inter', sans-serif",
  },
};
