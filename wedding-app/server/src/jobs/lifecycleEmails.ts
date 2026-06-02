/**
 * Lifecycle email engine.
 *
 * Ties together the pieces that already exist:
 *   email_automations (rule) → email_templates (content) → guests (recipients)
 *   → SMTP integration (transport) → job_queue ('email.send') → scheduled_emails (log)
 *
 * Entry points:
 *   runTrigger(eventId, trigger)  — fan out one trigger for one event NOW.
 *   scanRsvpReminders()           — periodic: find events whose rsvp_deadline
 *                                   is within the automation's offset window
 *                                   and fire reminders to pending guests.
 *
 * Idempotency: scheduled_emails has UNIQUE(event_id, guest_id, trigger_type),
 * so a guest is never double-sent the same lifecycle email for an event, even
 * if a trigger fires repeatedly (status flips, daily scan re-runs, etc).
 */
import { db } from '../db/database.js';
import { jobsRepo } from '../db/repos/jobs.js';
import { eventsRepo, orgsRepo, guestsRepo } from '../db/repos/index.js';
import { emailAutomationsRepo, type TriggerType } from '../db/repos/emailAutomations.js';
import { emailTemplatesRepo } from '../db/repos/emailTemplates.js';
import { scheduledEmailsRepo } from '../db/repos/scheduledEmails.js';
import { integrationsRepo } from '../db/repos/integrations.js';

export interface RunTriggerResult {
  trigger: TriggerType;
  eventId: string;
  scheduled: number;     // emails queued this run
  skipped: number;       // guests skipped (no email, already sent, declined…)
  reason?: string;       // populated when nothing ran (no automation / no SMTP)
}

/** Build the merge-field map for a guest. Mirrors the /preview sample keys. */
function mergeDataFor(
  event: { title: string; start_date: string | null; slug: string },
  org: { name: string },
  guest: { full_name: string; table_assignment: string | null },
  portalLink: string,
): Record<string, string> {
  const eventDate = event.start_date
    ? new Date(event.start_date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'TBD';
  return {
    guest_name: guest.full_name,
    event_title: event.title,
    event_date: eventDate,
    table_assignment: guest.table_assignment ?? 'TBD',
    venue_name: org.name,
    portal_link: portalLink,
  };
}

function portalLinkFor(eventId: string): string {
  const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/#/portal/${eventId}`;
}

/** Pick eligible guests for a trigger. */
function eligibleGuests(eventId: string, trigger: TriggerType) {
  const guests = guestsRepo.listForEvent(eventId).filter((g) => !!g.email);
  switch (trigger) {
    case 'rsvp_reminder':
      return guests.filter((g) => g.rsvp_status === 'pending');
    case 'thank_you':
      return guests.filter((g) => g.rsvp_status === 'attending');
    case 'save_the_date':
    case 'manual':
    default:
      return guests;
  }
}

/**
 * Fan out a single trigger for one event. Safe to call repeatedly — already
 * sent guests are skipped via the scheduled_emails idempotency key.
 */
export function runTrigger(eventId: string, trigger: TriggerType): RunTriggerResult {
  const out: RunTriggerResult = { trigger, eventId, scheduled: 0, skipped: 0 };

  const event = eventsRepo.findById(eventId);
  if (!event) { out.reason = 'event-not-found'; return out; }

  const automation = emailAutomationsRepo.findActive(event.organization_id, trigger);
  if (!automation) { out.reason = 'no-active-automation'; return out; }

  const template = emailTemplatesRepo.findById(automation.template_id);
  if (!template) { out.reason = 'template-missing'; return out; }

  // Find a connected SMTP integration to actually send through.
  const smtp = integrationsRepo.findByOrgProvider(event.organization_id, 'email_smtp');
  if (!smtp || smtp.status !== 'connected') { out.reason = 'no-smtp-integration'; return out; }

  const org = orgsRepo.findById(event.organization_id);
  if (!org) { out.reason = 'org-not-found'; return out; }

  const link = portalLinkFor(eventId);
  const guests = eligibleGuests(eventId, trigger);

  for (const guest of guests) {
    // Idempotency: skip if we've already scheduled this trigger for this guest.
    if (scheduledEmailsRepo.exists(eventId, guest.id, trigger)) { out.skipped++; continue; }

    const rendered = emailTemplatesRepo.render(template, mergeDataFor(event, org, guest, link));

    const log = scheduledEmailsRepo.create({
      organizationId: event.organization_id,
      eventId,
      guestId: guest.id,
      automationId: automation.id,
      templateId: template.id,
      triggerType: trigger,
      recipientEmail: guest.email!,
      subject: rendered.subject,
    });
    if (!log) { out.skipped++; continue; } // raced — already inserted

    // Enqueue the actual send through the existing email.send worker handler.
    const job = jobsRepo.enqueue({
      kind: 'email.send',
      organizationId: event.organization_id,
      payload: {
        integrationId: smtp.id,
        to: guest.email!,
        subject: rendered.subject,
        html: rendered.html || undefined,
        text: rendered.text || undefined,
        scheduledEmailId: log.id,
      },
    });
    scheduledEmailsRepo.attachJob(log.id, job.id);
    scheduledEmailsRepo.markSent(log.id, job.id); // "sent" = handed to the queue
    out.scheduled++;
  }

  return out;
}

/**
 * Periodic scan: for every org with an enabled rsvp_reminder automation, find
 * events whose rsvp_deadline falls within `offset_days` from now (and hasn't
 * passed) and fire reminders. A per-event/day marker row prevents re-scanning.
 */
export function scanRsvpReminders(): { eventsProcessed: number; emailsScheduled: number } {
  let eventsProcessed = 0;
  let emailsScheduled = 0;

  const automations = db.prepare(
    `SELECT * FROM email_automations WHERE trigger_type = 'rsvp_reminder' AND enabled = 1`,
  ).all() as Array<{ organization_id: string; offset_days: number }>;

  for (const a of automations) {
    // Events in this org with a future rsvp_deadline within the window.
    const events = db.prepare(
      `SELECT id, rsvp_deadline FROM events
       WHERE organization_id = ?
         AND deleted_at IS NULL
         AND rsvp_deadline IS NOT NULL
         AND status NOT IN ('completed','cancelled','lost')
         AND date(rsvp_deadline) >= date('now')
         AND date(rsvp_deadline) <= date('now', '+' || ? || ' days')`,
    ).all(a.organization_id, a.offset_days) as Array<{ id: string }>;

    for (const e of events) {
      // Daily marker so we don't re-run the same event multiple times a day.
      const dayMarker = `rsvp_scan:${new Date().toISOString().slice(0, 10)}`;
      const marker = scheduledEmailsRepo.create({
        organizationId: a.organization_id,
        eventId: e.id,
        guestId: null,
        triggerType: dayMarker,
        recipientEmail: 'system',
        subject: 'rsvp scan marker',
      });
      if (!marker) continue; // already scanned this event today

      const res = runTrigger(e.id, 'rsvp_reminder');
      eventsProcessed++;
      emailsScheduled += res.scheduled;
    }
  }

  return { eventsProcessed, emailsScheduled };
}
