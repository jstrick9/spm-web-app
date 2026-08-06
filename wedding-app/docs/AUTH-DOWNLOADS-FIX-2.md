# AUTH-DOWNLOADS-FIX-2 — two more protected exports were plain <a href download>

The AUTH-DOWNLOADS pass converted most protected export links to the
JWT-carrying `downloadFile()` helper, but a sweep for remaining
`<a href download>` / `<a href>` links against `/api/` found two missed
surfaces where the export endpoint requires `requireAuth`:

## 1. Couple Advanced Planning exports (travel microsite, planning packet)
`CoupleAdvancedPlanning.tsx` rendered `query.data.exports` as plain
`<a href={item.href} download>` — the endpoints
(`/api/events/:id/couple-advanced-planning/travel-microsite.txt`, …) are
`requireAuth`; a plain navigation 401s (the browser hits the API URL with
no Authorization header). The couple clicking "Download guest travel
microsite" got a JSON 401 page instead of the file.

## 2. Couple Post-Event Closeout final packet
`CouplePostEventCloseout.tsx` rendered
`<a href={finalPacketUrl} download>` for
`/api/events/:id/couple-post-event/final-packet.txt` — same class of bug:
401 for authenticated couples.

## Fix
Both now call `downloadFile(url, { filename })` with an error toast on
failure (the established AUTH-DOWNLOADS pattern).

## Verified NOT bugs (kept as plain links)
- Guest portal downloads (offline pass, travel card, calendar .ics) —
  public portal endpoints by design.
- Post-event gallery documents (`/api/portal/:id/post-event-gallery/…`) —
  public route gated only by approval status.
- Event "document vault" + vendor portal documents — free-form external
  URLs entered by venue staff (Google Drive links, etc.).
