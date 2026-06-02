/**
 * portalTypes.ts — Typed shapes for the public guest portal.
 *
 * WHY A SEPARATE FILE (not just additions to types.ts)
 * ─────────────────────────────────────────────────────
 * types.ts is already 325 lines and excluded from coverage (src/sdk/types.ts
 * is in the vite.config.ts coverage exclusion list). Keeping portal-specific
 * types in their own module makes the boundary clear:
 *   - types.ts  → shared cross-domain types (auth, orgs, events, guests…)
 *   - portalTypes.ts → public portal-specific shapes (no auth required)
 *
 * All shapes are derived directly from the server response in
 * server/src/routes/guests.ts  GET /api/portal/:eventId/info
 *
 * Phase 34b changes:
 *   - PortalTheme: NEW — the `theme` field returned by the info endpoint
 *     was completely absent from SdkPortalInfo, forcing PublicGuestPortal
 *     to cast the entire response to `any` just to read r.theme.
 *   - PortalGuestEntry: extracted sub-type of the guests array
 *   - LayoutCanvasItem: discriminated union for canvas floor-plan items;
 *     eliminates `item: any` inside PortalMapViewer's items.map()
 *   - PortalInfoResponse: the complete typed response replacing `r: any`
 */

// ── Portal theme ──────────────────────────────────────────────────────────
/**
 * Subset of the org's platformConfig.theme returned by the portal info endpoint.
 * All fields optional — the endpoint returns whatever the org has configured,
 * falling back to the portal's DEFAULT_PALETTE for anything missing.
 *
 * Server source: orgsRepo → org.settings → JSON.parse → settings.platformConfig.theme
 */
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
/**
 * Minimal guest record returned to the public portal (no email, no phone —
 * only what a guest needs to find themselves and locate their seat).
 *
 * Server source: guestsRepo.listForEvent → filter(allow_portal_access) → map
 */
export interface PortalGuestEntry {
  id: string;
  fullName: string;
  tableAssignment: string | null;
  seatAssignment: string | null;
}

// ── Canvas layout items ───────────────────────────────────────────────────
/**
 * Discriminated union for every item type the floor-plan canvas can contain.
 * Eliminates the `item: any` annotation inside PortalMapViewer.
 *
 * Server source: layoutsRepo → layouts[0].payload → JSON.parse → .items[]
 * Client source: CanvasPage stores items in this shape via react-konva.
 *
 * Note: `x`, `y`, `id`, `label` are present on all item types.
 * Type-specific properties (radius, width/height, rotation, guestId) are
 * only present on the relevant discriminant.
 */
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

/** Any other item types the canvas may add in future phases. */
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

/** Shape of the layout JSON blob stored in the layouts table. */
export interface PortalLayoutPayload {
  items: LayoutCanvasItem[];
  /** Venue boundary or other top-level canvas config — not used by portal viewer. */
  [key: string]: unknown;
}

// ── Full portal info response ─────────────────────────────────────────────
/**
 * Complete typed shape of GET /api/portal/:eventId/info.
 *
 * Previously PublicGuestPortal used `.then((r: any) => …)` because `theme`
 * was absent from SdkPortalInfo. This type replaces that `any` entirely.
 *
 * NOTE: This type EXTENDS the existing SdkPortalInfo from types.ts rather
 * than replacing it so existing consumers of SdkPortalInfo (EventDetail,
 * GuestPortalSettingsTab, etc.) are unaffected.
 */
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
  /** Null when the org has not configured a theme preset. */
  theme: PortalTheme | null;
}

// ── RSVP submission input ─────────────────────────────────────────────────
/**
 * What PublicGuestPortal sends to POST /api/portal/:eventId/rsvp.
 * Mirrors RsvpInput in sdk/guests.ts but scoped to the portal use-case
 * (no guestId field — the guestId is always provided by the portal).
 */
export interface PortalRsvpInput {
  guestId: string;
  attending: boolean;
  mealChoice?: string;
  notes?: string;
}
