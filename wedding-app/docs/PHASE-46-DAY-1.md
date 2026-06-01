# Phase 46 · Day 1 — Code Review Fixes + First Intelligence Features

Fixes all remaining code review issues and implements the first two intelligence platform features.

---

## Code Review Fixes

### Medium Priority
| Fix | Details |
|---|---|
| **Audit log LIMIT** | Default capped at 200 rows (was unbounded). Prevents 50K+ row responses for long-running venues. |

### Low Priority  
| Fix | Details |
|---|---|
| **`any` type reduction** | Typed `OrgMember` in TeamMembers, typed event/vendor in command palette builders. Reduced highest-impact `any` usage. |
| **Error handling standardization** | Contracts create/sign converted from `.then().catch()` to proper `useMutation` with `onSuccess`/`onError` callbacks. |

### Accessibility
| Fix | Details |
|---|---|
| **`aria-label` on icon buttons** | Added to delete buttons (budget, contracts, gallery, inventory, webhooks), block remove (invites). |
| **`aria-live="polite"` on notification badge** | Screen readers now announce unread count changes. |
| **`aria-label` on EventDetail TabsList** | Tab navigation now has `aria-label="Event detail sections"`. |

---

## Feature F-1: iCal Calendar Export

**Value**: Every venue coordinator uses Google Calendar. One-click sync eliminates double-entry.

### Implementation
- **Server**: `GET /api/events/:eventId/export.ics` — generates iCalendar (.ics) format with:
  - Event title, start/end dates
  - Guest count + budget in description
  - Status mapping (completed → COMPLETED, others → CONFIRMED)
  - Proper Content-Disposition for browser download
  - RBAC-gated: requires `events.view`

- **Client**: "Add to Calendar" button in EventDetail header (alongside View Portal, Print Run Sheet, Duplicate, Check-In)

### Usage
Click "Add to Calendar" → browser downloads `.ics` file → double-click opens in Google Calendar / Outlook / Apple Calendar.

---

## Feature F-2: Revenue Pipeline Forecasting Widget

**Value**: Venue owners need to predict future revenue for staffing and purchasing decisions.

### Implementation
- **Widget**: `kpi.pipeline-forecast` in the widget registry
- **Calculation**: Weights each event by conversion probability:
  - Lead: 10%
  - Hold: 40%
  - Booked: 90%
  - Planning: 95%
  - Completed: 100%
- **Display**: StatCard showing weighted pipeline total + confirmed revenue
- **Added to default dashboard** alongside existing KPIs

### Example
> Pipeline forecast: **$127,500**
> $112,000 confirmed

---

## Verification

```
Server:  258/258 tests (0 failures)
Client:  426/426 tests (0 failures)
Total:   684/684 (0 regressions)
Typecheck: clean
Build: clean (11 chunks)
```

---

## Files Modified (12)

```
server/src/routes/audit.ts                          # LIMIT 200 default
server/src/routes/exports.ts                        # iCal export endpoint
client/src/App.tsx                                  # Typed command palette builders
client/src/screens/events/EventDetail.tsx            # Add to Calendar button + TabsList aria-label
client/src/screens/events/contracts/EventContractsTab.tsx  # useMutation pattern
client/src/screens/events/budget/EventBudgetTab.tsx  # aria-label on delete
client/src/screens/events/gallery/EventGalleryTab.tsx  # aria-label on remove
client/src/screens/events/invites/EventInvitesTab.tsx  # sr-only on block remove
client/src/screens/system/IntegrationHub.tsx          # aria-labels on webhook actions
client/src/screens/system/inventory/InventoryManager.tsx  # aria-label on delete
client/src/screens/system/admin/TeamMembers.tsx        # Typed OrgMember
client/src/components/notifications/NotificationCenter.tsx  # aria-live on badge
client/src/config/widgets/registry.tsx                 # Pipeline forecast widget
client/src/config/defaults.ts                          # Forecast in default dashboard
```

---

## Platform Statistics (46 Phases)

| Category | Count |
|---|---|
| Database tables | 45 |
| API endpoints | **93** (+1 iCal) |
| RBAC permissions | 72 |
| **Total tests** | **684** |
| Dashboard widgets | **12** (+1 pipeline forecast) |
| Intelligence features | Revenue forecast, booking conversion, RSVP velocity, event readiness, today view, revenue by month, dietary breakdown, timeline density, vendor compliance |
| Keyboard shortcuts | ⌘K + ⌘N + ⌘/ |
| Event actions | View Portal, Print Run Sheet, **Add to Calendar**, Duplicate, Check-In |
