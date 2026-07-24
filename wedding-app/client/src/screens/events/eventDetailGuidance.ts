import type { TabId } from './eventTabConfig';
import { eventSetupItems, safeMetadata, type EventRsvpCounts } from './eventDetailUtils';

export const MANAGER_TAB_HELP: Record<
  TabId,
  { responsibility: string; example: string; href: string }
> = {
  overview: {
    responsibility:
      "Confirm the event operating brief, ownership, readiness score, notes, documents, and next action before you go deeper.",
    example: "Show me an example operating brief",
    href: "#/events",
  },
  guests: {
    responsibility:
      "Work exceptions first: missing RSVPs, dietary, accessibility, VIPs, seating, lodging, and day-of lookup needs.",
    example: "Show me guest exceptions",
    href: "#/guests",
  },
  invites: {
    responsibility:
      "Confirm reminders and logistics messages are queued without over-messaging guests.",
    example: "Show me reminder workflow",
    href: "#/events",
  },
  feedback: {
    responsibility:
      "Prepare post-event feedback so closeout learns from guest experience and incidents.",
    example: "Show me feedback examples",
    href: "#/reports",
  },
  timeline: {
    responsibility:
      "Verify the run-of-show, dependencies, vendor arrivals, staffing coverage, and late-item risk.",
    example: "Show me timeline readiness",
    href: "#/events",
  },
  vendors: {
    responsibility:
      "Confirm COIs, load-in, contact numbers, unread messages, portal completion, and day-of check-in readiness.",
    example: "Show me vendor readiness",
    href: "#/vendors",
  },
  budget: {
    responsibility:
      "Review operational financial blockers only; escalate payments, refunds, and pricing decisions to owner/admin as needed.",
    example: "Show me payment blocker examples",
    href: "#/intelligence",
  },
  contracts: {
    responsibility:
      "Look for operational obligations: insurance, alcohol, noise, overtime, cleanup, and signed-status blockers.",
    example: "Show me contract operations examples",
    href: "#/intelligence",
  },
  gallery: {
    responsibility:
      "Use documents/photos as the event file: permits, BEOs, layout packets, incident photos, and closeout evidence.",
    example: "Show me document examples",
    href: "#/events",
  },
  staff: {
    responsibility:
      "Run the what-to-do-now queue, staff contacts, shifts, incidents, and coverage gaps.",
    example: "Show me staff task examples",
    href: "#/calendar",
  },
  layout: {
    responsibility:
      "Review readiness, ADA/exits, seating, vendor zones, power, approval, and print packet; use canvas editing only when needed.",
    example: "Show me layout readiness",
    href: "#/events",
  },
  emergency: {
    responsibility:
      "Know emergency contacts, procedures, weather/rain plan, incident path, and who has authority to decide.",
    example: "Show me escalation examples",
    href: "#/events",
  },
  chat: {
    responsibility:
      "Keep internal/planner/vendor communication traceable and escalate sensitive decisions.",
    example: "Show me communication examples",
    href: "#/events",
  },
  portal: {
    responsibility:
      "Verify guest-facing content before changes go live and escalate risky public changes if required.",
    example: "Show me portal QA",
    href: "#/events",
  },
  settings: {
    responsibility:
      "Only change operationally safe details. Escalate owner/admin settings or event status questions.",
    example: "Show me permission guidance",
    href: "#/settings/profile",
  },
};

export function missingCountForTab(
  tabId: TabId,
  event: any,
  counts?: EventRsvpCounts,
) {
  const metadata = safeMetadata(event.metadata);
  const totalGuests = counts
    ? counts.pending + counts.attending + counts.declined + counts.maybe
    : 0;
  const map: Partial<Record<TabId, number>> = {
    overview: eventSetupItems(event, counts).filter((i) => !i.done).length,
    guests: totalGuests > 0 ? 0 : 1,
    invites: totalGuests > 0 ? 0 : 1,
    timeline: metadata.timelineStarted ? 0 : 1,
    vendors: metadata.vendorPortalConfigured ? 0 : 1,
    budget: event.budget_cents || metadata.quoteCents ? 0 : 1,
    contracts:
      metadata.depositDueDate ||
      ["lead", "hold", "lost", "cancelled"].includes(event.status)
        ? 0
        : 1,
    layout: metadata.layoutStarted ? 0 : 1,
    portal: metadata.guestPortalConfigured ? 0 : 1,
    staff: metadata.staffAssigned ? 0 : 1,
  };
  return map[tabId] ?? 0;
}
