/**
 * Lifecycle email SDK — automation rules, manual sends, and the send log.
 */
import { api } from './client.js';

export type LifecycleTrigger = 'rsvp_reminder' | 'thank_you' | 'save_the_date' | 'manual';

export interface SdkEmailAutomation {
  id: string;
  organization_id: string;
  template_id: string;
  trigger_type: LifecycleTrigger;
  offset_days: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface SdkScheduledEmail {
  id: string;
  event_id: string;
  guest_id: string | null;
  trigger_type: string;
  recipient_email: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface SendResult {
  trigger: LifecycleTrigger;
  eventId: string;
  scheduled: number;
  skipped: number;
  reason?: string;
}

export const lifecycleEmailsSdk = {
  listAutomations(orgId: string): Promise<{ automations: SdkEmailAutomation[] }> {
    return api.get(`/api/orgs/${orgId}/email-automations`);
  },

  upsertAutomation(orgId: string, input: {
    templateId: string;
    triggerType: LifecycleTrigger;
    offsetDays?: number;
    enabled?: boolean;
  }): Promise<{ automation: SdkEmailAutomation }> {
    return api.put(`/api/orgs/${orgId}/email-automations`, input);
  },

  deleteAutomation(id: string): Promise<void> {
    return api.delete(`/api/email-automations/${id}`);
  },

  send(eventId: string, triggerType: LifecycleTrigger): Promise<{ result: SendResult }> {
    return api.post(`/api/events/${eventId}/lifecycle-emails/send`, { triggerType });
  },

  log(eventId: string): Promise<{
    emails: SdkScheduledEmail[];
    stats: { pending: number; sent: number; failed: number; skipped: number };
  }> {
    return api.get(`/api/events/${eventId}/lifecycle-emails`);
  },
};
