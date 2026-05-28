/**
 * One-stop SDK entrypoint. Most callers should:
 *
 *   import { sdk } from '@/sdk';
 *   const events = await sdk.events.list(orgId);
 *
 * Individual domain modules can also be imported directly:
 *
 *   import { eventsSdk } from '@/sdk/events';
 */
export { ApiError, api, getToken, setToken, subscribe, isServerReachable } from './client.js';
export type { ClientEvent, RequestOptions } from './client.js';
export * from './types.js';

import { authSdk }    from './auth.js';
import { orgsSdk }    from './orgs.js';
import { rolesSdk }   from './roles.js';
import { eventsSdk }  from './events.js';
import { venuesSdk }  from './venues.js';
import { catalogSdk } from './catalog.js';
import { layoutsSdk } from './layouts.js';
import { guestsSdk, rsvpSdk, portalSdk } from './guests.js';
import { vendorsSdk } from './vendors.js';
import { timelineSdk } from './timeline.js';
import { staffSdk } from './staff.js';
import { questionsSdk } from './questions.js';
import { feedbackSdk } from './feedback.js';
import { platformConfigSdk } from './platformConfig.js';

export const sdk = {
  auth:     authSdk,
  orgs:     orgsSdk,
  roles:    rolesSdk,
  events:   eventsSdk,
  venues:   venuesSdk,
  catalog:  catalogSdk,
  layouts:  layoutsSdk,
  guests:   guestsSdk,
  rsvps:    rsvpSdk,
  portal:   portalSdk,
  vendors:  vendorsSdk,
  timeline: timelineSdk,
  staff:    staffSdk, questionsSdk, feedbackSdk,
  questions: questionsSdk,
  feedback: feedbackSdk,
  platformConfig: platformConfigSdk, staffSdk,
} as const;

// Re-export domain SDKs too so per-domain imports work
export {
  authSdk, orgsSdk, rolesSdk, eventsSdk, venuesSdk, catalogSdk,
  layoutsSdk, guestsSdk, rsvpSdk, portalSdk, vendorsSdk, timelineSdk, platformConfigSdk,
};
