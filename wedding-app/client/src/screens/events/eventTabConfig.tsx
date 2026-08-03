import type { ReactNode } from 'react';
import { BarChart, ClipboardCheck, ClipboardList, Cog, DollarSign, FileSignature, ImageIcon, LayoutGrid, Link as LinkIcon, Mail, MapPin, MessageCircle, ShieldAlert, Truck, Users } from 'lucide-react';
import type { SdkEventStatus } from '../../sdk/types';

export type TabId =
  | "overview"
  | "guests"
  | "timeline"
  | "vendors"
  | "budget"
  | "contracts"
  | "gallery"
  | "staff"
  | "layout"
  | "invites"
  | "feedback"
  | "chat"
  | "portal"
  | "settings"
  | "emergency";
export type EventDetailPermission =
  | "guests.view"
  | "invites.view"
  | "feedback.view"
  | "timeline.view"
  | "vendors.view"
  | "vendors.checkin.view"
  | "budget.view"
  | "contracts.view"
  | "gallery.view"
  | "staff.view"
  | "messages.view"
  | "layouts.view"
  | "portal.config.manage"
  | "portal.guest.view"
  | "events.edit"
  | "events.create"
  | "calendar.view";

// ─── Tab definitions with RBAC mapping ──────────────────
export type TabGroup =
  | "Planning"
  | "Guests"
  | "Vendors"
  | "Financials"
  | "Operations"
  | "Portals";

export interface TabDef {
  id: TabId;
  label: string;
  group: TabGroup;
  description: string;
  icon: ReactNode;
  /** Permission required to see this tab. null = always visible. */
  permission: EventDetailPermission | null;
}

export const TAB_DEFS: TabDef[] = [
  {
    id: "overview",
    label: "Overview",
    group: "Planning",
    description:
      "Start here: readiness, setup checklist, next steps, notes, assignments, and activity.",
    icon: <LayoutGrid className="h-3.5 w-3.5 mr-1" />,
    permission: null,
  },
  {
    id: "timeline",
    label: "Timeline",
    group: "Planning",
    description:
      "Build ceremony, reception, vendor, and staff run-of-show timing.",
    icon: <ClipboardList className="h-3.5 w-3.5 mr-1" />,
    permission: "timeline.view",
  },
  {
    id: "layout",
    label: "Layout",
    group: "Planning",
    description:
      "Create floorplans, seating, zones, approvals, and layout readiness.",
    icon: <MapPin className="h-3.5 w-3.5 mr-1" />,
    permission: "layouts.view",
  },
  {
    id: "guests",
    label: "Guests",
    group: "Guests",
    description:
      "Manage guest list, RSVPs, dietary needs, seating, lodging, and imports.",
    icon: <Users className="h-3.5 w-3.5 mr-1" />,
    permission: "guests.view",
  },
  {
    id: "invites",
    label: "Invites",
    group: "Guests",
    description:
      "Send invitations, reminders, lifecycle emails, and RSVP communications.",
    icon: <Mail className="h-3.5 w-3.5 mr-1" />,
    permission: "invites.view",
  },
  {
    id: "feedback",
    label: "Polls & Feedback",
    group: "Guests",
    description: "Collect NPS, polls, and post-event guest feedback.",
    icon: <BarChart className="h-3.5 w-3.5 mr-1" />,
    permission: "feedback.view",
  },
  {
    id: "vendors",
    label: "Vendors",
    group: "Vendors",
    description:
      "Book vendors, track COIs, logistics, payments, and portal links.",
    icon: <Truck className="h-3.5 w-3.5 mr-1" />,
    permission: "vendors.view",
  },
  {
    id: "budget",
    label: "Budget",
    group: "Financials",
    description:
      "Track budget items, payment links, deposits, and actual spend.",
    icon: <DollarSign className="h-3.5 w-3.5 mr-1" />,
    permission: "budget.view",
  },
  {
    id: "contracts",
    label: "Contracts",
    group: "Financials",
    description: "Create, send, sign, and store contract records.",
    icon: <FileSignature className="h-3.5 w-3.5 mr-1" />,
    permission: "contracts.view",
  },
  {
    id: "gallery",
    label: "Documents",
    group: "Financials",
    description: "Store event images and document vault files/links.",
    icon: <ImageIcon className="h-3.5 w-3.5 mr-1" />,
    permission: "gallery.view",
  },
  {
    id: "staff",
    label: "Staff",
    group: "Operations",
    description:
      "Assign staff, tasks, areas, shifts, and day-of responsibilities.",
    icon: <ClipboardCheck className="h-3.5 w-3.5 mr-1" />,
    permission: "staff.view",
  },
  {
    id: "emergency",
    label: "Emergency",
    group: "Operations",
    description:
      "Emergency contacts, procedures, and event-day risk protocols.",
    icon: <ShieldAlert className="h-3.5 w-3.5 mr-1" />,
    permission: null,
  },
  {
    id: "chat",
    label: "Chat",
    group: "Operations",
    description: "Internal and external event communication threads.",
    icon: <MessageCircle className="h-3.5 w-3.5 mr-1" />,
    permission: "messages.view",
  },
  {
    id: "portal",
    label: "Portal",
    group: "Portals",
    description:
      "Configure public guest portal content, access, RSVP, and theme.",
    icon: <LinkIcon className="h-3.5 w-3.5 mr-1" />,
    permission: "portal.config.manage",
  },
  {
    id: "settings",
    label: "Settings",
    group: "Portals",
    description:
      "Edit event details, assignment, visibility, and status/archive flows.",
    icon: <Cog className="h-3.5 w-3.5 mr-1" />,
    permission: "events.edit",
  },
];

export const ACTION_PERMISSIONS = {
  guestPortal: "portal.guest.view",
  runSheet: "timeline.view",
  calendarExport: "calendar.view",
  duplicate: "events.create",
  vendorCheckIn: "vendors.checkin.view",
} as const satisfies Record<string, EventDetailPermission>;

// ─── Stage-aware tab visibility ────────────────────────────────────────────
// Event pipeline stages: lead | hold | booked | planning | final_review |
// completed | cancelled | lost.
// Tabs whose concerns do not exist yet at a stage are hidden so the event
// workspace reads as the current phase of work rather than a full feature
// catalog (per the Seven Paths Manor blueprint §4.4).
const TABS_HIDDEN_BY_STAGE: Partial<Record<SdkEventStatus, TabId[]>> = {
  // Sales phase: no staff, no event-week risk protocols, no guest portal yet.
  lead: ["staff", "emergency", "portal"],
  hold: ["staff", "emergency", "portal"],
  // Booked but not yet planning: same operational surfaces deferred.
  booked: ["staff", "emergency", "portal"],
  // Planning: emergency protocols appear once the plan is concrete.
  planning: ["emergency"],
  // final_review and completed: everything relevant is on screen.
  final_review: [],
  completed: [],
};

/** Filter tabs for an event's pipeline stage. Unknown statuses show all tabs. */
export function filterTabsForStage(tabs: TabDef[], status?: string | null): TabDef[] {
  if (!status) return tabs;
  const hidden = TABS_HIDDEN_BY_STAGE[status as SdkEventStatus];
  if (!hidden || hidden.length === 0) return tabs;
  return tabs.filter((tab) => !hidden.includes(tab.id));
}

