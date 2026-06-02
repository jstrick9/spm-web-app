/**
 * Lifecycle emails SDK — automation rules + manual sends + send log.
 *
 * NEW SDK module wiring the lifecycleEmailRoutes endpoints.
 */
import { api } from './client.js';

export type TriggerType = 'rsvp_reminder' | 'thank_you' | 'save_the_date' | 'manual';

export interface SdkEmailAutomation {
  id: string;
  organization_id: string;
  template_id: string;
  template_name?: string; // joined from email_templates
  trigger_type: TriggerType;
  offset_days: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SdkScheduledEmail {
  id: string;
  event_id: string;
  guest_id: string | null;
  template_id: string;
  trigger_type: TriggerType;
  to_email: string;
  to_name: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

export interface SendStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
}

export interface TriggerResult {
  scheduled: number;
  skipped: number;
  reason?: string;
}

export const lifecycleEmailsSdk = {
  // ── Automation rules ───────────────────────────────────────────────────

  listAutomations(orgId: string): Promise<{ automations: SdkEmailAutomation[] }> {
    return api.get(`/api/orgs/${orgId}/email-automations`);
  },

  upsertAutomation(
    orgId: string,
    input: {
      triggerType: TriggerType;
      templateId: string;
      offsetDays?: number;
      enabled?: boolean;
    },
  ): Promise<{ automation: SdkEmailAutomation }> {
    return api.put(`/api/orgs/${orgId}/email-automations`, input);
  },

  deleteAutomation(automationId: string): Promise<void> {
    return api.delete(`/api/email-automations/${automationId}`);
  },

  // ── Manual trigger ("send now") ────────────────────────────────────────

  /**
   * Manually run a lifecycle email trigger for an event.
   * Idempotency: server rejects with 409 if same trigger ran within 1h.
   */
  sendNow(
    eventId: string,
    triggerType: TriggerType,
  ): Promise<{ result: TriggerResult }> {
    return api.post(`/api/events/${eventId}/lifecycle-emails/send`, { triggerType });
  },

  // ── Send log ───────────────────────────────────────────────────────────

  listForEvent(eventId: string): Promise<{
    emails: SdkScheduledEmail[];
    stats: SendStats;
  }> {
    return api.get(`/api/events/${eventId}/lifecycle-emails`);
  },
};
