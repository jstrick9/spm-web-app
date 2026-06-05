/**
 * portalTypes.ts — Typed shapes for the public guest portal.
 *
 * Phase 34b: initial version (PortalTheme, PortalGuestEntry,
 *   LayoutCanvasItem discriminated union, PortalLayoutPayload,
 *   PortalInfoResponse, PortalRsvpInput).
 *
 * Phase 35a additions:
 *   PollOption — the individual choice shape inside a Poll.
 *   Re-exported from here so PublicGuestPortal.tsx imports from one place.
 *
 * All shapes derived directly from:
 *   server/src/routes/guests.ts     GET /api/portal/:eventId/info
 *   server/src/routes/feedback.ts   GET /api/events/:eventId/polls
 *   client/src/sdk/feedback.ts      Poll interface
 */

// ── Portal theme ──────────────────────────────────────────────────────────

export interface PortalTheme {
  bgColor?: string;
  surfaceColor?: string;
  borderColor?: string;
  fgColor?: string;
  fgMutedColor?: string;
  fgSubtleColor?: string;
  brandColor?: string;
  brandFgColor?: string;
  brandHoverColor?: string;
  accentColor?: string;
  accentSoftColor?: string;
}

// ── Portal guest entry ────────────────────────────────────────────────────

export interface PortalGuestEntry {
  id: string;
  fullName: string;
  tableAssignment: string | null;
  seatAssignment: string | null;
  roomAssignment: string | null;
  allowLodgingAccess?: boolean;
  subEventInvites?: string[];
}

// ── Canvas layout items (discriminated union) ─────────────────────────────

interface CanvasItemBase {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface RoundTableItem extends CanvasItemBase {
  type: 'round_table';
  radius: number;
}

export interface RectTableItem extends CanvasItemBase {
  type: 'rect_table';
  width: number;
  height: number;
  rotation: number;
}

export interface DanceFloorItem extends CanvasItemBase {
  type: 'dance_floor';
  width: number;
  height: number;
  rotation: number;
}

export interface ChairItem extends CanvasItemBase {
  type: 'chair';
  radius: number;
  guestId: string | null;
  guestInitials: string | null;
}

export interface UnknownCanvasItem extends CanvasItemBase {
  type: string;
  [key: string]: unknown;
}

export type LayoutCanvasItem =
  | RoundTableItem
  | RectTableItem
  | DanceFloorItem
  | ChairItem
  | UnknownCanvasItem;

export interface PortalLayoutPayload {
  items: LayoutCanvasItem[];
  [key: string]: unknown;
}

// ── Full portal info response ─────────────────────────────────────────────

export interface PortalInfoResponse {
  event: {
    id: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
  };
  portalEnabled: boolean;
  requiresPassword: boolean;
  guests: PortalGuestEntry[];
  layout: PortalLayoutPayload | null;
  theme: PortalTheme | null;
}

// ── RSVP submission input ─────────────────────────────────────────────────

export interface PortalRsvpInput {
  guestId: string;
  attending: boolean;
  mealChoice?: string;
  notes?: string;
  subEventRSVPs?: Record<string, boolean>;
}

// ── Poll option (Phase 35a) ───────────────────────────────────────────────
/**
 * Individual choice inside a Poll.
 * Mirrors the shape from server feedback routes and sdk/feedback.ts Poll.options[].
 * Extracted here so PublicGuestPortal.tsx can type poll.options.map()
 * without importing from a separate SDK module.
 */
export interface PollOption {
  id: string;
  text: string;
  votes: number;
}
