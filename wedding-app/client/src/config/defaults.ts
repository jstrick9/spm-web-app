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
      { id: 'venueStudio' },
      { id: 'inventory' },
      { id: 'vendors' },
      { id: 'reports' },

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

  setup: {
    ownerSetup: {
      status: 'not_started',
      completedSteps: [],
    },
  },

  onboarding: {
    welcomeTourByOrg: {},
  },

  admin: {
    setupChecklist: [
      { id: 'identity', label: 'Venue identity and contact details', required: true, ownerHelp: 'This powers contracts, portals, and client-facing email copy.' },
      { id: 'spaces', label: 'Spaces, capacities, and ceremony/reception options', required: true, ownerHelp: 'Required for safe layout planning and event templates.' },
      { id: 'policies', label: 'Venue rules and insurance policies', required: true, ownerHelp: 'Shown to planners, vendors, and couples at the right time.' },
      { id: 'templates', label: 'Default event, timeline, and message templates', required: false, ownerHelp: 'Speeds up first event creation and onboarding.' },
      { id: 'notifications', label: 'Notification preferences and critical alerts', required: true, ownerHelp: 'Controls who hears about health drops, overdue RSVPs, and vendor risks.' },
    ],
    venuePolicies: [
      { key: 'insurance', label: 'Vendor insurance / COI requirement', value: 'Certificate of insurance required before load-in.', ownerVisible: true },
      { key: 'noise', label: 'Noise ordinance', value: 'Amplified music must follow local ordinance and venue quiet hours.', ownerVisible: true },
      { key: 'alcohol', label: 'Alcohol service', value: 'Licensed bartending and host approval required for alcohol service.', ownerVisible: true },
      { key: 'load_in', label: 'Vendor load-in window', value: 'Default load-in begins four hours before ceremony unless approved.', ownerVisible: true },
      { key: 'cleanup', label: 'Cleanup expectations', value: 'Planner and vendors must complete strike by contracted end time.', ownerVisible: true },
    ],
    defaultTemplates: [
      { key: 'wedding_event', label: 'Wedding event setup', category: 'event', enabled: true },
      { key: 'traditional_timeline', label: 'Traditional wedding timeline', category: 'timeline', enabled: true },
      { key: 'standard_contract', label: 'Standard venue contract', category: 'contract', enabled: true },
      { key: 'rsvp_reminder', label: 'RSVP reminder message', category: 'message', enabled: true },
      { key: 'go_live_checklist', label: 'Event go-live checklist', category: 'checklist', enabled: true },
    ],
    notificationPreferences: [
      { channel: 'email', enabled: true, criticalOnly: false },
      { channel: 'in_app', enabled: true, criticalOnly: false },
      { channel: 'push', enabled: false, criticalOnly: true },
      { channel: 'sms', enabled: false, criticalOnly: true },
    ],
    dataRetention: {
      eventArchiveMonths: 84,
      guestPortalDataMonths: 24,
      auditLogMonths: 84,
      autoDeleteInactiveLeads: false,
    },
  },
};
