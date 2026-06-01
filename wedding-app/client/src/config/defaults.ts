/**
 * SYSTEM_DEFAULTS — the in-code config every install starts with.
 *
 * This is the bottom of the cascade. Org/event/user configs override it.
 * The values match the Day 1 design tokens exactly, so an empty org config
 * means "use the tokens shipped by the developer."
 */
import type { PlatformConfig } from './schema.js';

export const SYSTEM_DEFAULTS: PlatformConfig = {
  theme: {
    brand:        '74 25 66',
    brandStrong:  '56 19 50',
    brandSoft:    '241 230 240',
    accent:       '201 165 96',
    accentSoft:   '245 237 218',
    bg:           '253 250 248',
    surface:      '255 255 255',
    surface2:     '247 244 240',
    border:       '232 226 220',
    fg:           '28 25 22',
    fgMuted:      '89 82 76',

    fontDisplay:  'Fraunces',
    fontBody:     'Inter',
    fontMono:     'JetBrains Mono',

    density:      'comfortable',
    radius:       'soft',
    motion:       'standard',
    colorScheme:  'system',
  },

  // Widget slots — each dashboard surface defines its default contents
  widgets: {
    'venue.dashboard.kpis': {
      widgets: [
        { id: 'kpi.booking-conversion' },
        { id: 'kpi.revenue-per-event' },
        { id: 'kpi.rsvp-velocity' },
        { id: 'kpi.vacancy' },
        { id: 'kpi.pipeline-forecast' },
      ],
    },
    'event.detail.intelligence': {
      widgets: [
        { id: 'kpi.guest-count' },
        { id: 'kpi.rsvp-rate' },
        { id: 'chart.dietary-breakdown' },
        { id: 'chart.timeline-density' },
      ],
    },
    'couple.portal.hero': {
      widgets: [
        { id: 'hero.event-countdown' },
        { id: 'hero.rsvp-cta' },
      ],
    },
  },

  layout: {
    navItems: [
      { id: 'dashboard' },
      { id: 'events' },
      { id: 'guests' },
      { id: 'vendors' },
      { id: 'reports' },
      { id: 'system' },
    ],
    sidebarCollapsedByDefault: false,
    featureFlags: {
      reports:      true,
      vendor_portal:true,
      messaging:    true,
      audit_log:    true,
    },
  },

  branding: {
    platformName: 'Wedding Venue Intelligence',
    logoUrl:      '',
    favicon:      '',
    supportEmail: '',
    tagline:      'Where every detail is intentional.',
  },
};
