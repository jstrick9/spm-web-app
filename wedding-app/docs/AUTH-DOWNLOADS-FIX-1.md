# AUTH-DOWNLOADS-FIX-1 — authenticated file downloads

Session date: 2026-08-05

## The bug

The API authenticates **exclusively** via `Authorization: Bearer <JWT>`
(`fastify-jwt` + `requireAuth`); the app stores the token in `localStorage`
and never sets cookies. But **13+ export links across the app were plain
`<a href="/api/...">` anchors with `download`** — anchor navigation cannot
carry an Authorization header, so every one of them returned **401** when
clicked in a real browser:

- Couple hub: guest CSV export, couple calendar ICS, final document packet,
  contract/payment packet, seating chart CSV, place cards, couple timeline
  ICS, privacy-panel data exports
- Event detail: "Add to Calendar" (`export.ics`)
- Manager panels: operations packet ZIP, day-of packet JSON
- Integrations hub: guests CSV, financials JSON, vendors CSV
- Vendor COI file "View" link (`/api/assets/:id/content`)

This is a severe functional gap: every venue, couple, and vendor-facing
export button in the app was a dead link in production (only `adminPanels`
backup export had implemented the fetch-with-token pattern).

## The fix

New SDK helper `downloadFile(path, { open?, filename? })` in
`sdk/client.ts`:

1. `fetch(path)` with the stored JWT (`Authorization: Bearer`),
2. error mapping identical to `request()` (offline/forbidden/not-found/…)
   via `ApiError`,
3. turns the response into a Blob URL and either downloads it (honoring
   the server's `Content-Disposition` filename) or opens it in a new tab
   (`open: true`, for viewing COI PDFs),
4. revokes the object URL after a delay.

All 13+ call sites updated to intercept the anchor click
(`e.preventDefault()` + `downloadFile(...)`), with destructive toasts on
failure where a toast context exists. `adminPanels.tsx` already used the
correct pattern (fetch + blob) and was left as-is.

## Tests

- `client/src/sdk/client.test.ts` (4): JWT header sent + blob download with
  server filename; non-OK responses map to typed `ApiError`; network
  failures map to `offline`; `open: true` opens a sandboxed blob tab.
- Full client suite green (910+).

## Notes

- Guest-portal public downloads (`/api/portal/...` ICS, travel card, guest
  pass) are intentionally **public** (token in query string) and were left
  as anchors.
- The vendor COI viewer keeps `target="_blank"` semantics by opening the
  fetched blob in a new tab.

## Follow-up — document viewers + couple document Open button

- `EventGalleryTab` "View" links pointed at the auth'd couple-document
  content endpoint — same 401 bug. Now intercepted with
  `downloadFile(..., { open: true })`.
- Couple hub document list previously had **no way to open a document at
  all** (filename/status/delete only). Added an "Open" button using the
  auth'd download helper.
- Final sweep confirms zero remaining unprotected `/api/` anchors except
  intentionally public `/api/portal` and `/api/public` endpoints.
