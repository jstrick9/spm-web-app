# Day-of & Privacy Pass 1 — Real QR, Private Docs, Venue Visibility

Five commits this session, all on `main` / `develop` / `staging` /
`feature/fixes_web_app`.

## 1. Staff-help QR was decorative — now real + scannable (`f01715d`, `6af9ef9`)

The guest portal's "Staff help QR" rendered a **hash-derived pseudo
pattern** that no QR scanner could read, despite the UI telling guests
staff can scan it to "find your RSVP/table". Now:

- `StaffHelpQr` encodes a **real QR** (`qrcode`, dynamically imported so
  the bundle budget is untouched) as SVG-string → data-URI image (no
  canvas dependency — works in every browser and test env), alt-labeled
  for a11y. The plain-text payload remains visible as a fallback.
- **VendorCheckInApp scanner understands `WVI-GUEST-HELP:<event>:<guest>`
  codes**: staff scan the guest's phone → toast shows "Guest: name ·
  RSVP status · Table/Seat" so staff never browse the guest list aloud.
  Non-matching codes keep the vendor check-in flow.
- Repeat-poll-tap and repeat-NPS-submit now get friendly UX instead of
  unhandled rejections / raw 403s (one vote/response per device is
  server-enforced).

## 2. Couple-private documents were readable by any venue staff (`b4ecf1a`, `201317a`)

The couple-documents **list + content** endpoints checked only
`events.view` — any venue staff member could list and download documents
the couple had marked `visibility:'couple'` (private insurance files,
private notes). Visibility semantics now enforced server-side:

- couple-role members see everything;
- venue staff see `couple_venue` / `planner` / `vendor` /
  `guest_visible` — never `couple`-private docs (404 on content, no
  existence oracle; filtered out of the list and the final document
  packet).

## 3. The venue finally sees couple-shared documents (`977cdf7`)

Couples upload documents marked `couple_venue` expecting the venue to
see them — but **no venue UI consumed the endpoint**, so shared menus
and insurance sat invisible (a one-way visibility system). The gallery
tab now renders a **"Couple-shared documents"** panel (filename,
category, visibility, approval status, notes, View link) backed by the
server-filtered list.

## Verification

- Server **580 tests / 80 files** · Client **896 tests / 134 files** —
  both suites green (the one transient client failure was the known
  vitest cache flake; re-run clean).
- `tsc --noEmit` clean; production build + bundle budgets satisfied.
- Working tree clean; all branches in sync at `977cdf7`.
