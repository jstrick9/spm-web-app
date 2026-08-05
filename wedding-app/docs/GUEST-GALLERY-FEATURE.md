# Guest-Visible Post-Event Gallery — Feature Completion

## Status before this change (NON-FUNCTIONAL feature)

The couple hub let couples mark uploaded documents as **`guest_visible`**
(e.g. a `post_event_gallery` photo PDF), but the only links emitted by the
platform pointed at `/api/events/:id/couple-documents/:id/content` — an
**auth-required** endpoint (`requireAuth` + `events.view`). Guests opening
a "guest-visible" photo got a 401. The visibility option existed; the
guest experience did not.

## What changed

### Server

- **`GET /api/portal/:eventId/post-event-gallery/:documentId`** (new,
  public, rate-limited 60/min) streams a gallery document **only** when
  ALL of:
  - `category = 'post_event_gallery'`
  - `visibility = 'guest_visible'`
  - `approval_status = 'approved'`
  - document belongs to `:eventId`
  Anything else → `404 document-not-found` (no existence oracle, no
  internal paths leaked). Responses carry the stored MIME type plus the
  global `X-Content-Type-Options: nosniff` header.
- **Guest portal info** (`/api/portal/:eventId/info`) now includes
  `guestPostEvent.galleryDocuments` — the approved/guest-visible docs
  with their public URLs (max 12).
- **Couple post-event summary** (`/api/events/:id/couple-post-event`)
  gallery docs gain a `guestUrl` field so the couple can copy/share the
  guest link directly.

### Client

- `GuestMemoryPhotoSharing` (guest portal home) renders a **"Photos from
  your day"** section listing the shared docs above the existing memory
  links, styled with the portal palette and `rel="noreferrer noopener"`.
- `sdk/portalTypes.ts` types updated (`galleryDocuments`).

### Security notes

- No private storage paths are ever emitted (public URLs only).
- A document stops being reachable the moment the couple/venue changes
  its visibility, category, or approval — the check runs on every request.
- Rate-limited like every public portal endpoint; same trust level as the
  public calendar.ics/travel-card (the venue explicitly opted the photo in).

## Tests

- `server/src/routes/guest-gallery.integration.test.ts` (6):
  listing in portal payload; streaming with MIME + nosniff; 404 matrix
  (pending / couple-visible / wrong category / unknown id); cross-event
  isolation; couple-side `guestUrl`; couple role can read the summary.
- `client/src/screens/portal/GuestPortalHome.test.tsx` (3): renders the
  gallery section + link href; hides when empty; defensive default when
  `guestPostEvent` is null.

## Verification

- Server: **568 tests / 80 files** · Client: **882 tests / 134 files**.
- `tsc --noEmit` clean both apps; client production build + bundle
  budgets satisfied.
- Malformed-input probes this round: 27 public-portal + 9 vendor-portal
  requests (garbage ids/bodies, missing/wrong tokens) → zero 5xx and no
  unauthenticated data leaks.
- Reviewed and confirmed safe (no change needed): upload validation
  (content-type allowlist + nosniff + private files via authed routes),
  couple-document access control + filename sanitization, guest reminder
  delivery flow (email/SMS jobs), RSVP edit-window enforcement, couple
  RSVP-reminder approval workflow, TodayView local-date keys, ICS/CSV
  injection guards (previous pass).
