/**
 * Seven Paths Manor - Layout Planner Configuration
 *
 * Easy configuration for branding and customization.
 * These values can be updated via the Admin Panel or directly here.
 */

import { STORAGE_KEYS } from './constants/storageKeys';
import { STORAGE_VERSIONS } from './constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from './utils/storage';

const CONFIG_STORAGE_KEY = STORAGE_KEYS.CONFIG;
const CONFIG_STORAGE_VERSION = STORAGE_VERSIONS.CONFIG;

export interface Config {
  // Branding
  logoUrl: string;
  venueName: string;
  tagline: string;
  location: string;
  websiteUrl: string;
  supportEmail: string;
  phone?: string;

  // Color Palette
  primaryColor: string;
  primaryDark: string;
  primaryLight: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;

  // Typography
  fontFamily: string;
  headingFontFamily: string;
  headerTextColor: string;
  bodyTextColor: string;
  accentTextColor: string;

  // Welcome Settings
  welcomeLogoUrl?: string;
  welcomeTitle?: string;
  showWelcomeByDefault?: boolean;
  /** Feature chips shown on welcome screen for non-admin users */
  welcomeFeatures?: string[];
}

// Default configuration
export const defaultConfig: Config = {
  logoUrl: '',
  venueName: 'Seven Paths Manor',
  tagline: 'Affordable Luxury - Weddings Reimagined',
  location: 'Spring Hope, NC',
  websiteUrl: 'https://www.sevenpathsmanor.com',
  supportEmail: 'weddings@sevenpathsmanor.com',
  phone: '',

  primaryColor: '#4A1942',
  primaryDark: '#3d1a45',
  primaryLight: '#6b2c5c',
  accentColor: '#8B5A8B',
  backgroundColor: '#f3f4f6',
  textColor: '#1f2937',

  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  headerTextColor: '#FFFFFF',
  bodyTextColor: '#374151',
  accentTextColor: '#4A1942',

  welcomeLogoUrl: '',
  welcomeTitle: 'Welcome to the Wedding Venue Layout Planner',
  showWelcomeByDefault: true,
  welcomeFeatures: [
    'Layout Design',
    'Guest Management',
    'Templates',
    'Print & Share',
    'Event Questions',
    'Chat',
  ],
};

function readEnvString(name: string): string | undefined {
  const value = import.meta.env?.[name as keyof ImportMetaEnv];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readEnvBoolean(name: string): boolean | undefined {
  const value = import.meta.env?.[name as keyof ImportMetaEnv];
  if (typeof value !== 'string') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function getRuntimeDefaultConfig(): Config {
  return {
    ...defaultConfig,
    primaryColor:
      readEnvString('VITE_BRANDING_PRIMARY_COLOR') ?? defaultConfig.primaryColor,
    showWelcomeByDefault:
      readEnvBoolean('VITE_SHOW_WELCOME_BY_DEFAULT') ??
      defaultConfig.showWelcomeByDefault,
  };
}

export function getConfig(): Config {
  try {
    return loadVersionedStorage<Config>({
      key: CONFIG_STORAGE_KEY,
      defaultValue: getRuntimeDefaultConfig(),
      currentVersion: CONFIG_STORAGE_VERSION,
      migrations: {
        0: (input) => ({ ...getRuntimeDefaultConfig(), ...(input as Partial<Config>) }),
      },
      normalize: (value) => ({ ...getRuntimeDefaultConfig(), ...value }),
    });
  } catch (e) {
    console.error('Failed to load config:', e);
    return getRuntimeDefaultConfig();
  }
}

export function updateConfig(config: Partial<Config>): void {
  try {
    const current = getConfig();
    const updated = { ...current, ...config };
    saveVersionedStorage(CONFIG_STORAGE_KEY, CONFIG_STORAGE_VERSION, updated);
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

export function setConfig(config: Config): void {
  try {
    saveVersionedStorage(CONFIG_STORAGE_KEY, CONFIG_STORAGE_VERSION, config);
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

export function resetConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}

const CONFIG = getConfig();
export default CONFIG;