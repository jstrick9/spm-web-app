/**
 * Curated theme presets. Admins pick one as a starting point; advanced
 * users open the "Custom Theme" mode to tweak any individual token.
 *
 * Each preset is a PARTIAL config — only theme fields. Picking a preset
 * doesn't touch widgets, layout, or branding.
 *
 * Adding a new preset: add an entry below + an entry in src/config/presets.test.ts
 * to guarantee it parses against the schema.
 */
import type { PartialPlatformConfig } from './schema.js';

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  /** Visual swatch shown in the picker — array of rgb triplets for chips. */
  swatch: string[
];
  config: PartialPlatformConfig;
}

export const THEME_PRESETS: ReadonlyArray<ThemePreset> = [
  // ─── Default ─────────────────────────────────────
  {
    id: 'classic-aubergine',
    name: 'Classic Aubergine',
    description: 'Deep purple + champagne gold. Editorial, sophisticated. The system default.',
    swatch: ['74 25 66', '201 165 96', '247 244 240'],
    config: {
      theme: {
        brand: '74 25 66', brandStrong: '56 19 50', brandSoft: '241 230 240',
        accent: '201 165 96', accentSoft: '245 237 218',
        bg: '253 250 248', surface: '255 255 255', surface2: '247 244 240',
        border: '232 226 220', fg: '28 25 22', fgMuted: '89 82 76',
        fontDisplay: 'Fraunces', fontBody: 'Inter', fontMono: 'JetBrains Mono',
        density: 'comfortable', radius: 'soft', motion: 'standard', colorScheme: 'system',
      },
    },
  },

  // ─── Coastal ─────────────────────────────────────
  {
    id: 'coastal-navy',
    name: 'Coastal Navy',
    description: 'Deep navy + sand. Crisp, modern, beach-wedding-friendly.',
    swatch: ['28 60 95', '212 178 130', '241 237 230'],
    config: {
      theme: {
        brand: '28 60 95', brandStrong: '16 40 70', brandSoft: '218 232 248',
        accent: '212 178 130', accentSoft: '245 238 222',
        bg: '252 250 246', surface: '255 255 255', surface2: '244 240 232',
        border: '226 220 208', fg: '20 24 35', fgMuted: '82 88 102',
        fontDisplay: 'Cormorant Garamond', fontBody: 'Inter', fontMono: 'IBM Plex Mono',
        density: 'comfortable', radius: 'soft', motion: 'standard', colorScheme: 'system',
      },
    },
  },

  // ─── Garden ──────────────────────────────────────
  {
    id: 'garden-sage',
    name: 'Garden Sage',
    description: 'Muted sage green + terracotta. Outdoor / botanical aesthetic.',
    swatch: ['62 86 64', '198 110 70', '244 240 232'],
    config: {
      theme: {
        brand: '62 86 64', brandStrong: '36 58 40', brandSoft: '224 232 222',
        accent: '198 110 70', accentSoft: '249 226 210',
        bg: '249 246 240', surface: '255 254 250', surface2: '241 236 226',
        border: '218 212 198', fg: '32 30 24', fgMuted: '92 86 74',
        fontDisplay: 'Lora', fontBody: 'Source Sans 3', fontMono: 'JetBrains Mono',
        density: 'comfortable', radius: 'soft', motion: 'standard', colorScheme: 'system',
      },
    },
  },

  // ─── Modern ──────────────────────────────────────
  {
    id: 'modern-onyx',
    name: 'Modern Onyx',
    description: 'High contrast black-and-white with electric accent. Editorial-loft.',
    swatch: ['18 18 20', '255 90 120', '248 248 248'],
    config: {
      theme: {
        brand: '18 18 20', brandStrong: '8 8 12', brandSoft: '232 232 232',
        accent: '255 90 120', accentSoft: '255 232 236',
        bg: '252 252 252', surface: '255 255 255', surface2: '245 245 246',
        border: '224 224 224', fg: '14 14 16', fgMuted: '88 88 92',
        fontDisplay: 'Playfair Display', fontBody: 'Inter', fontMono: 'JetBrains Mono',
        density: 'comfortable', radius: 'sharp', motion: 'minimal', colorScheme: 'system',
      },
    },
  },

  // ─── Blush ───────────────────────────────────────
  {
    id: 'blush-rose',
    name: 'Blush Rose',
    description: 'Soft pink + dusty rose-gold. Romantic, traditional.',
    swatch: ['158 73 85', '215 168 145', '252 244 240'],
    config: {
      theme: {
        brand: '158 73 85', brandStrong: '120 50 62', brandSoft: '246 224 226',
        accent: '215 168 145', accentSoft: '250 236 226',
        bg: '253 248 245', surface: '255 254 252', surface2: '247 238 232',
        border: '232 218 212', fg: '34 28 28', fgMuted: '102 88 88',
        fontDisplay: 'Fraunces', fontBody: 'Inter', fontMono: 'JetBrains Mono',
        density: 'comfortable', radius: 'pill', motion: 'expressive', colorScheme: 'system',
      },
    },
  },

  // ─── Industrial ──────────────────────────────────
  {
    id: 'industrial-slate',
    name: 'Industrial Slate',
    description: 'Concrete grey + brass. Warehouse / loft-venue vibe.',
    swatch: ['62 72 82', '188 142 78', '236 236 232'],
    config: {
      theme: {
        brand: '62 72 82', brandStrong: '38 46 56', brandSoft: '224 228 232',
        accent: '188 142 78', accentSoft: '244 232 210',
        bg: '248 248 244', surface: '255 255 252', surface2: '238 238 232',
        border: '212 212 204', fg: '22 24 28', fgMuted: '86 90 96',
        fontDisplay: 'Playfair Display', fontBody: 'IBM Plex Sans', fontMono: 'IBM Plex Mono',
        density: 'compact', radius: 'sharp', motion: 'minimal', colorScheme: 'system',
      },
    },
  },
  // ─── Seven Paths Manor ───────────────────────────────
  {
    id: 'seven-paths-manor',
    name: 'Seven Paths Manor',
    description: 'Rich black + deep plum. Dramatic luxury inspired by sevenpathsmanor.com.',
    swatch: ['13 13 13', '74 26 78', '248 248 246'],
    config: {
      theme: {
        brand: '74 26 78', brandStrong: '50 10 54', brandSoft: '240 228 242',
        accent: '107 45 112', accentSoft: '232 214 235',
        bg: '248 248 246', surface: '255 255 255', surface2: '244 240 244',
        border: '220 210 222', fg: '13 13 13', fgMuted: '74 74 78',
        fontDisplay: 'Playfair Display', fontBody: 'Inter', fontMono: 'JetBrains Mono',
        density: 'comfortable', radius: 'soft', motion: 'standard', colorScheme: 'system',
      },
    },
  },

];

export function getPreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}
