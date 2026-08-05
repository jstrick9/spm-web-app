/**
 * Lifecycle email job worker.
 *
 * runTrigger(eventId, triggerType)
 *   — called on status → completed by BOTH the PATCH /api/events/:id route and the
 *     POST /api/events/:id/stage stage endpoint (thank_you)
 *   — called by the manual "Send Now" POST route
 *   — called by the nightly cron scan (scanUpcomingDeadlines)
 *
 * scanUpcomingDeadlines()
 *   — call from the job queue worker on a 'lifecycle_email.scan' job
 *   — enqueues per-guest sends for rsvp_reminder when deadline is approaching
 *   — safe to call daily; idempotency keys prevent double-sends
 *
 * Design rules:
 *   1. ALWAYS async — the route now properly awaits this.
 *   2. NEVER throws for "no automation configured" — just returns { scheduled: 0 }.
 *   3. Per-guest sends use idempotency keys (event_id + guest_id + trigger_type + date).
 *   4. Respects per-org SMTP integration — if none exists, logs and skips gracefully.
 *   5. Does NOT send email itself — writes to scheduled_emails; the delivery worker
 *      picks those up and calls the SMTP integration provider.
 */
import {
  eventsRepo,
  guestsRepo,
  emailAutomationsRepo,
  emailTemplatesRepo,
  scheduledEmailsRepo,
  integrationsRepo,
  auditRepo,
} from '../db/repos/index.js';

export type TriggerType = 'rsvp_reminder' | 'thank_you' | 'save_the_date' | 'manual';

export interface TriggerResult {
  scheduled: number;
  skipped: number;
  reason?: string;
}

/**
 * Find the SMTP integration for an org. Returns null if none configured.
 * The actual send happens asynchronously via the delivery worker.
 */
function hasSmtpIntegration(orgId: string): boolean {
  const integrations = integrationsRepo.listForOrg(orgId);
  return integrations.some(
    (i) => i.provider === 'email_smtp' && i.status === 'connected',
  );
}

/**
 * Build merge fields for a guest + event (used by emailTemplatesRepo.render).
 */
function buildMergeFields(
  guest: { full_name: string; email: string | null },
  event: {
    id: string;
    title: string;
    start_date: string | null;
    rsvp_deadline: string | null;
    organization_id: string;
  },
): Record<string, string> {
  return {
    guest_name: guest.full_name,
    event_title: event.title,
    event_date: event.start_date
      ? new Date(event.start_date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'TBD',
    rsvp_deadline: event.rsvp_deadline
      ? new Date(event.rsvp_deadline).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '',
    portal_link: `${process.env.BASE_URL ?? 'https://your-venue.com'}/#/portal/${event.organization_id}`,
    survey_link: `${process.env.BASE_URL ?? 'https://your-venue.com'}/#/survey/${event.id}`,
  };
}

/**
 * Run a specific trigger type for a single event.
 * Returns the count of emails scheduled in this call.
 */
export async function runTrigger(
  eventId: string,
  triggerType: TriggerType,
): Promise<TriggerResult> {
  const event = eventsRepo.findById(eventId);
  if (!event) return { scheduled: 0, skipped: 0, reason: 'event-not-found' };

  const orgId = event.organization_id;

  // Guard: SMTP integration must be configured
  if (!hasSmtpIntegration(orgId)) {
    return { scheduled: 0, skipped: 0, reason: 'no-smtp-integration' };
  }

  // Guard: automation rule must be configured and enabled for this trigger
  const automations = emailAutomationsRepo.listForOrg(orgId);
  const automation = automations.find(
    (a) => a.trigger_type === triggerType && a.enabled,
  );
  if (!automation) {
    return { scheduled: 0, skipped: 0, reason: 'no-automation-configured' };
  }

  // Load the template
  const template = emailTemplatesRepo.findById(automation.template_id);
  if (!template) {
    return { scheduled: 0, skipped: 0, reason: 'template-not-found' };
  }

  // For guest-targeted triggers, iterate per guest
  let guests = guestsRepo.listForEvent(eventId).filter((g) => !!g.email);
  if (triggerType === 'thank_you') {
    guests = guests.filter((g) => g.rsvp_status === 'attending');
  } else if (triggerType === 'rsvp_reminder') {
    guests = guests.filter((g) => g.rsvp_status === 'pending');
  }

  if (guests.length === 0) {
    return { scheduled: 0, skipped: 0, reason: 'no-guests-with-email' };
  }

  let scheduled = 0;
  let skipped = 0;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD idempotency key

  for (const guest of guests) {
    // Skip if already sent for this (event + guest + trigger + day)
    const existing = scheduledEmailsRepo.findByIdempotencyKey(
      eventId,
      guest.id,
      triggerType,
      today,
    );
    if (existing) {
      skipped++;
      continue;
    }

    // Render the template with guest+event merge fields. IN-05: a broken
    // template must not kill the whole automation run — isolate per guest.
    let rendered: ReturnType<typeof emailTemplatesRepo.render>;
    try {
      const mergeFields = buildMergeFields(guest, event);
      rendered = emailTemplatesRepo.render(template, mergeFields);
    } catch (err) {
      auditRepo.log({
        organizationId: orgId, actorLabel: 'system',
        action: 'lifecycle_email.render_failed', targetType: 'event', targetId: eventId,
        details: { triggerType, guestId: guest.id, templateId: template.id, error: (err as Error).message },
      });
      skipped++;
      continue;
    }

    // Enqueue the send
    scheduledEmailsRepo.enqueue({
      eventId,
      guestId: guest.id,
      templateId: template.id,
      triggerType,
      toEmail: guest.email!,
      toName: guest.full_name,
      subject: rendered.subject,
      bodyHtml: rendered.html,
      bodyText: rendered.text,
      idempotencyKey: `${eventId}:${guest.id}:${triggerType}:${today}`,
      scheduledFor: new Date().toISOString(),
    });

    scheduled++;
  }

  return { scheduled, skipped };
}

/**
 * Nightly scan — called by the job queue worker on 'lifecycle_email.scan'.
 * Finds events whose RSVP deadline is within the configured offset_days and
 * enqueues per-guest rsvp_reminder sends (idempotent — safe to run daily).
 */
export async function scanUpcomingDeadlines(): Promise<{
  eventsScanned: number;
  totalScheduled: number;
}> {
  const now = new Date();
  // Get all active events with an upcoming RSVP deadline
  const allOrgs = eventsRepo.listAllOrgIds();
  let eventsScanned = 0;
  let totalScheduled = 0;

  for (const orgId of allOrgs) {
    const automations = emailAutomationsRepo.listForOrg(orgId);
    const rsvpAuto = automations.find(
      (a) => a.trigger_type === 'rsvp_reminder' && a.enabled,
    );
    if (!rsvpAuto) continue;

    const offsetDays = rsvpAuto.offset_days ?? 7;

    // Events whose deadline is exactly `offsetDays` days from now.
    // rsvp_deadline is a LOCAL calendar date (YYYY-MM-DD from the date
    // picker); deriving the target with toISOString() (UTC) shifts the
    // comparison by one day in US timezones, firing reminders a day late.
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + offsetDays);
    const targetDateStr =
      `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    const events = eventsRepo.listForOrg(orgId, { status: ['booked', 'planning'] });
    for (const event of events) {
      if (!event.rsvp_deadline) continue;
      if (event.rsvp_deadline.slice(0, 10) !== targetDateStr) continue;

      eventsScanned++;
      const result = await runTrigger(event.id, 'rsvp_reminder');
      totalScheduled += result.scheduled;
    }
  }

  return { eventsScanned, totalScheduled };
}
