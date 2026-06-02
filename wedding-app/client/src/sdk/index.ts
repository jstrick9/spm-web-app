/**
 * One-stop SDK entrypoint.
 */
export { ApiError, api, getToken, setToken, subscribe, isServerReachable } from './client.js';
export type { ClientEvent, RequestOptions } from './client.js';
export * from './types.js';

import { authSdk }    from './auth.js';
import { profileSdk } from "./auth.js";
import { auditSdk } from "./audit.js";
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
import { pushSdk } from './push.js';
import { webhooksSdk } from './webhooks.js';
import { budgetSdk } from './budget.js';
import { contractsSdk } from './contracts.js';
import { inventorySdk } from './inventory.js';
import { gallerySdk } from './gallery.js';
import { vendorRatingsSdk, emailTemplatesSdk, paymentLinksSdk, recommendationsSdk, forecastSdk, vendorScoringSdk, riskSdk } from "./intelligence.js";
import { checkinsSdk } from "./checkins.js";
import { inviteTrackingSdk } from "./inviteTracking.js";
import { lifecycleEmailsSdk } from "./lifecycleEmails.js";

export const sdk = {
  auth:           authSdk,
  profile:        profileSdk,
  audit:          auditSdk,
  orgs:           orgsSdk,
  roles:          rolesSdk,
  events:         eventsSdk,
  venues:         venuesSdk,
  catalog:        catalogSdk,
  layouts:        layoutsSdk,
  guests:         guestsSdk,
  rsvps:          rsvpSdk,
  portal:         portalSdk,
  vendors:        vendorsSdk,
  timeline:       timelineSdk,
  staff:          staffSdk,
  questions:      questionsSdk,
  feedback:       feedbackSdk,
  platformConfig: platformConfigSdk,
  push:           pushSdk,
  webhooks:       webhooksSdk,
  budget:         budgetSdk,
  contracts:      contractsSdk,
  inventory:      inventorySdk,
  gallery:        gallerySdk,
  vendorRatings:  vendorRatingsSdk,
  emailTemplates: emailTemplatesSdk,
  paymentLinks:   paymentLinksSdk,
  recommendations: recommendationsSdk, forecast: forecastSdk, vendorScoring: vendorScoringSdk, risk: riskSdk, checkinsSdk, inviteTrackingSdk,
  checkins:       checkinsSdk,
  inviteTracking: inviteTrackingSdk,
  lifecycleEmails: lifecycleEmailsSdk,
} as const;

export {
  authSdk, orgsSdk, rolesSdk, eventsSdk, venuesSdk, catalogSdk,
  layoutsSdk, guestsSdk, rsvpSdk, portalSdk, vendorsSdk, timelineSdk,
  platformConfigSdk, staffSdk, questionsSdk, feedbackSdk, pushSdk,
  webhooksSdk, budgetSdk, contractsSdk, inventorySdk, gallerySdk, checkinsSdk, inviteTrackingSdk,
};

export { createSSEStream, type SSEEvent, type SSEEventHandler } from './sse.js';
