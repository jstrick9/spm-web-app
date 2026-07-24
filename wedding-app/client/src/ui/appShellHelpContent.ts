export const HELP_MODULES = [
  {
    title: "Events",
    detail:
      "Create weddings, track lead/hold/booked/planning status, and open each event workspace for guests, vendors, timeline, contracts, budget, layout, and portals.",
    next: "Manager next step: open the event with the nearest date and review operations readiness before sales/finance details.",
  },
  {
    title: "Guests",
    detail:
      "Import guest lists, track RSVPs, meal choices, dietary notes, accessibility needs, seating, lodging, and duplicate identities.",
    next: "Manager next step: work the exceptions first — no RSVP, dietary, accessibility, VIP, unseated, and lodging gaps.",
  },
  {
    title: "Vendors",
    detail:
      "Manage vendor contacts, preferred partners, contracts, payments, COIs, secure vendor portal links, and check-in readiness.",
    next: "Manager next step: verify COI, arrival time, contact phone, load-in path, and unread messages.",
  },
  {
    title: "Timeline",
    detail:
      "Build the run-of-show and detect timeline overlaps, missing ceremony/reception phases, and vendors not tied to timeline items.",
    next: "Manager next step: compare the timeline against vendor arrival, staffing coverage, and final run sheet.",
  },
  {
    title: "Layout",
    detail:
      "Create floorplans, seating, tables, vendor zones, approval workflows, and readiness checks for capacity/collisions.",
    next: "Manager next step: use mobile review mode to verify ADA path, exits, power, seating, vendor zones, and print packet.",
  },
  {
    title: "Staff",
    detail:
      "Assign staff tasks, shifts, incident follow-up, coverage, and day-of command responsibilities.",
    next: "Manager next step: open the What-to-do-now queue and make sure critical tasks have contacts.",
  },
  {
    title: "Contracts & Payments",
    detail:
      "Track agreements, e-signature state, payment links, balances due, and budget performance.",
    next: "Manager next step: only review operational blockers; escalate legal/finance decisions to the owner/admin.",
  },
  {
    title: "Intelligence",
    detail:
      "Use Event Health Command Center, forecast, vendor reliability, guest identity, RSVP lag, and readiness signals to prioritize action.",
    next: "Manager next step: filter for actions you can fix today and assign/escalate the rest.",
  },
] as const;

export const GLOSSARY_TERMS = [
  ["Lead", "A new inquiry or early opportunity that has not committed yet."],
  [
    "Hold",
    "A date temporarily reserved while the couple decides or contract/payment is pending.",
  ],
  ["Booked", "The event is committed and should move into detailed planning."],
  [
    "Planning",
    "The event is actively being prepared: guests, vendors, timeline, budget, contracts, and layout.",
  ],
  [
    "SLA",
    "Service-level agreement or response target, such as responding to an inquiry, vendor issue, or guest problem within a set time.",
  ],
  [
    "BEO",
    "Banquet Event Order — the operational packet summarizing rooms, timeline, food/beverage, setup, staffing, and special instructions.",
  ],
  [
    "Load-in",
    "The scheduled window and route for vendors to arrive and bring equipment onto the property.",
  ],
  [
    "Strike",
    "The teardown/load-out process after an event, including rentals, cleanup, trash, and venue reset.",
  ],
  [
    "Captain mode",
    "A day-of operations mode where the lead manager prioritizes urgent tasks, incidents, staff coverage, and vendor arrivals.",
  ],
  [
    "Escalation",
    "A handoff to an owner/admin when an issue requires approval, finance/legal access, policy decision, or authority outside your role.",
  ],
  [
    "Incident",
    "A day-of problem that needs tracking, severity, owner awareness, or follow-up, such as safety, guest, vendor, damage, or weather issues.",
  ],
  [
    "Readiness",
    "A practical measure of whether an event is operationally ready: timeline, layout, guests, vendors, staff, contracts, payments, and risks.",
  ],
  [
    "Run sheet",
    "The day-of timeline that tells staff and vendors what happens when.",
  ],
  [
    "COI",
    "Certificate of Insurance — proof a vendor has required insurance coverage.",
  ],
  [
    "NPS",
    "Net Promoter Score — post-event feedback score from 0–10 that measures satisfaction.",
  ],
  [
    "Health score",
    "A 0–100 readiness/risk score based on alerts like RSVPs, contracts, balance due, vendors, and timeline coverage.",
  ],
  [
    "Vendor reliability score",
    "A 0–100 score based on vendor ratings, quality, timeliness, communication, and confidence.",
  ],
  [
    "Layout approval",
    "The process of marking a floorplan as approved for operational use.",
  ],
] as const;

export const MANAGER_LESSONS = [
  {
    id: "quick-start",
    title: "Manager quick start: first 30 minutes",
    minutes: 6,
    detail:
      "Check today’s events, health actions, open staff tasks, vendor exceptions, guest issues, and escalation blockers.",
    href: "#/",
  },
  {
    id: "event-review",
    title: "Review an event workspace",
    minutes: 8,
    detail:
      "Use Event Detail to inspect timeline, layout readiness, guests, vendors, staff, emergency plan, and notes.",
    href: "#/events",
  },
  {
    id: "run-sheet",
    title: "Use the run sheet and day-of mode",
    minutes: 5,
    detail:
      "Print or open phone-friendly run sheets, then use check-in, quick contacts, incident reporting, and sync status.",
    href: "#/calendar",
  },
  {
    id: "exceptions",
    title: "Work exception queues",
    minutes: 7,
    detail:
      "Prioritize RSVP lag, dietary/accessibility, missing COIs, unread vendor messages, unassigned critical staff tasks, and layout issues.",
    href: "#/intelligence",
  },
  {
    id: "escalation",
    title: "Escalate owner/admin issues",
    minutes: 4,
    detail:
      "Learn which budget, contract, integration, admin, and policy actions require owner/admin approval.",
    href: "#/system",
  },
] as const;

export const MANAGER_CERTIFICATION = [
  "Can explain event statuses and operational readiness",
  "Can find today’s events and assigned staff tasks",
  "Can review vendor COI/load-in/contact readiness",
  "Can use mobile guest lookup and guest exception filters",
  "Can review layout readiness and print a floorplan packet",
  "Can run Vendor Check-In and use manual fallback search",
  "Can report incidents and escalate admin/finance blockers",
] as const;

export const COUPLE_LESSONS = [
  { id: 'rsvp', title: 'How RSVP works', minutes: 4, detail: 'Track responses, meal choices, household groups, dietary notes, accessibility requests, and what guests can see.', href: '#/couple/events' },
  { id: 'floor-plan', title: 'How to review floor plans', minutes: 5, detail: 'Review tables, seating, ceremony/reception spaces, change requests, and approval status using couple-friendly floor plan language.', href: '#/couple/events' },
  { id: 'documents', title: 'How to sign documents', minutes: 4, detail: 'Understand contracts, invoices, shared documents, e-signature steps, pending items, and venue approval states.', href: '#/couple/events' },
  { id: 'messages', title: 'How to message the venue', minutes: 3, detail: 'Ask questions, request changes, find support contacts, and understand expected response status without internal operations language.', href: '#/couple/events' },
  { id: 'guest-visibility', title: 'What guests can see', minutes: 3, detail: 'Preview the guest RSVP portal, travel details, registry, schedule, seating visibility, and privacy boundaries before sharing links.', href: '#/portal/your-event-id' },
] as const;

export const COUPLE_GLOSSARY = [
  ['BEO', 'Banquet Event Order — the venue’s final event details packet. Couples usually review the client-facing summary, not staff-only operations notes.'],
  ['Final count', 'The final guest count due by the venue deadline, often used for catering, seating, staffing, and invoice adjustments.'],
  ['Room block', 'Reserved hotel/lodging rooms for guests, usually with a deadline and booking instructions.'],
  ['Rain plan', 'The approved backup plan for weather, including timing, spaces, guest communication, and layout changes.'],
  ['Load-in', 'The time vendors are allowed to arrive and set up. Couples may see a simple vendor arrival summary.'],
  ['Floor plan', 'The seating and room setup view showing tables, ceremony/reception spaces, dance floor, bars, and guest flow.'],
  ['Ceremony rehearsal', 'A scheduled practice before the wedding for processional order, family/wedding party cues, and venue logistics.'],
  ['Strike', 'Vendor and venue cleanup/load-out after the event. Usually internal, but it may affect contracted end time.'],
] as const;

export function helpContextForPath(path: string): string {
  if (path.includes("/couple/events/"))
    return "Current screen: Wedding Hub — start with your next 3 planning steps, then review RSVP, documents, floor plan, timeline, and venue messages.";
  if (path.includes("/events/") && path.includes("run-sheet"))
    return "Current screen: Run Sheet — focus on timeline, quick contacts, print packet, and day-of command actions.";
  if (path.includes("/events/") && path.includes("check-in"))
    return "Current screen: Vendor Check-In — focus on QR/manual fallback, vendor arrival status, and call/SMS actions.";
  if (path.includes("/events/"))
    return "Current screen: Event Detail — use tab guidance to review operations readiness and escalate restricted actions.";
  if (path.includes("/system/integrations"))
    return "Current screen: Integration Hub — managers should verify status and escalate broken provider setup to admins.";
  if (path.includes("/intelligence"))
    return "Current screen: Intelligence — work health actions you can fix; assign or escalate the rest.";
  if (path.includes("/guests"))
    return "Current screen: Guests — prioritize exceptions: RSVP, dietary, accessibility, VIP, seating, and lodging.";
  if (path.includes("/vendors"))
    return "Current screen: Vendors — prioritize COIs, arrival times, contacts, messages, and check-in readiness.";
  return "Current screen: Dashboard — start with today queue, event risk, assigned work, and manager onboarding checklist.";
}
