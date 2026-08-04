# Module 03 — Vendors (Directory, Event Vendors, Portals, COI, Check-in, Scoring, Payments)

**Reviewed:** 2026-08-04
**Surface:** `routes/vendors.ts` (16 endpoints), `routes/checkins.ts`, `db/repos/{vendors,checkins,vendorScoring,vendorRatings}.ts`, `sdk/{vendors,checkins}.ts`, `VendorDirectory`, `EventVendorsTab` + `vendorPanels`, `VendorFormDialog`, `VendorPaymentDialog`, `VendorCheckInApp`, `VendorCommunicationsHub`, `VendorPortal` + `VendorLogistics` + `vendorSections`, `ReliabilityBadge`
**Affected modules:** events (check-in boards), SSE/realtime, audit, guest portal patterns (COI), timeline (vendor-visible), assets

---

## 1. Bugs (fixed in this pass)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| VE-01 | High | **Check-in accepts a vendor from any event.** `POST /api/events/:id/checkins` upserts `vendor_checkins` for any `vendorId` — a staff member can check a *different event's* vendor into this event's board (the `UNIQUE(event_id, vendor_id)` then poisons the board). | Route now validates the vendor belongs to the event (400 `vendor-not-in-event`). |
| VE-02 | High | **COI verification is a dead end.** Vendor uploads COI → `coiVerificationStatus: 'pending_review'` is set, the venue table shows "COI Pending Review"… but there is **no approve/reject path anywhere** — no endpoint, no UI. Status is permanently stuck, and venue staff cannot even view the uploaded file (the private asset id is never surfaced; the form only shows manually typed insurer/policy fields). | New `POST /api/vendors/:id/coi-review` (vendors.manage, audited); COI upload now stores `coiAssetId`; venue UI gets **View COI + Approve / Request changes**; vendor portal shows verification status. |
| VE-03 | High | **"Preview Vendor Portal" rotates the vendor's active portal link and never opens the portal.** It calls `createAndCopyPortalLink` (new token → revokes the vendor's existing shared link) and only copies to clipboard. Staff clicking "Preview" silently breaks the vendor's active link. | "Preview" now re-opens the last generated portal URL (persisted per vendor in localStorage) without rotating; only explicit "Regenerate & Copy" rotates. |
| VE-04 | Med | **Vendor portal leaks internal data.** `GET /api/portal/vendors/:id/info` returns the raw event row (full `metadata`: internal budget, sales-to-ops handoff, day-of contact, setup checklist, manager warnings) and the full unfiltered timeline (other vendors' assignments + internal `notes`). | `publicVendorPortalView` now sanitizes the event (id/title/dates/status only) and filters the timeline to the vendor's own items plus audience-visible ones, stripping internal notes from items not assigned to them. |
| VE-05 | Med | **Money and vendor lifecycle unaudited.** `vendor.update`, `vendor.delete`, and `vendor.payment.add` write no audit entries — payment recording (money movement) has zero audit trail. | Added audit entries for vendor update, delete, payment add, payment delete, and COI review. |
| VE-06 | Med | **No SSE for vendor changes.** Update/delete/payment don't broadcast → VendorDirectory, the event vendors tab, dashboards, and the check-in board go stale across devices. | Added `vendor.updated`/`vendor.deleted`/`vendor.payment` SSE broadcasts (org-scoped). |
| VE-07 | Low-Med | **Payments can be added but never corrected.** A mistaken entry permanently inflates `amount_paid_cents` (no delete/refund path). | `DELETE /api/vendors/:id/payments/:paymentId` (vendors.manage, audited with original details, decrements the running total, floors at 0); payment history with delete in the payment dialog. |
| VE-08 | Low | **Check-in counts drop `late`.** `counts()` never counts `late` vendors (only expected/arrived/completed/departed). | `late` now reported in counts. |

## 2. Verified-working (no change needed)

- Portal token lifecycle: one-active-token rotation policy, hashed at rest, expiry, last-used tracking, per-vendor revocation, venue token-summary board.
- Vendor reliability scoring + tiering + confidence weighting; `VendorDirectory` reliability badges; `VendorMatchPanel` fit ranking.
- Check-in realtime: `vendor.checkin` SSE to the org; QR scan → vendor match → arrived; offline background-sync queue for check-ins.
- COI upload security: private storage + capability-scoped asset; invite delivery via SMTP or configurable webhook with fallback copy-only.
- Vendor messaging thread (`{eventId}:vendor-{id}`), venue communications hub, load-in packet generation, preferred-vendor compliance dashboard, arrival-risk scoring.

## 3. Improvements & notes (documented)

1. **Vendor payments are a ledger, not a CRM field.** `amount_paid_cents` denormalization is fine at this scale; deletion now preserves the full record in the audit log (original amount/date/method/notes).
2. **Timeline visibility policy** documented in the portal route: vendor sees their own items in full + the general run-of-show (titles/times/locations) with other vendors' internal notes stripped. If the venue wants stricter isolation, add a per-item `audience` column to `timeline_events` (future).
3. **Portal invite delivery** already degrades gracefully (SMTP → webhook → copy-only) with the URL returned each time.
4. **Check-in "late"** now appears in counts; the check-in board already had a "late" status option — it just wasn't counted.

## 4. Regression coverage added

- `server/src/routes/vendors-module.integration.test.ts` — 9 tests: check-in rejects cross-event vendor; COI review approve + changes_requested (audited, status transitions, vendor-visible); portal info sanitizes event metadata + strips other vendors' timeline notes; payment add/delete audit + running-total decrement; vendor update/delete audit + SSE.
- `client/src/screens/events/vendors/EventVendorsTab.test.tsx` — COI review actions render + fire; preview uses persisted URL without rotation (localStorage).
- Full suites re-run green (see §5).

## 5. Post-fix validation

- Server: typecheck clean, **481 tests passing** (68 files).
- Client: typecheck clean, **806 tests passing** (125 files).
- Production build + bundle budgets green (main 192 KB).
