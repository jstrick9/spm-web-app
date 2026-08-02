# Venue Portal Review

_Status: in progress — portal/module review began 2026-07-31._

## Scope

Seven Paths Manor owner, admin, manager, planner, and staff operational surfaces: Venue Studio, venue spaces, template gallery, inventory, event portfolio, layouts, staffing, Event Week execution, and venue-facing couple collaboration.

## Findings and remediation log

| Priority | Area | Finding | Impact | Status |
|---|---|---|---|---|
| High | Inventory reservations | Deleting an inventory item with active layout reservations cascaded to reservation records, silently breaking event setup commitments. | Inventory availability and layout/event operational integrity risk. | **Fixed** in `0fb8a74`: deletion is blocked while reservations exist and returns reservation count. |

## Next review sequence

1. Inventory lifecycle, reservation visibility, shortage/conflict behavior
2. Venue Studio spaces, templates, and structural/layout dependency behavior
3. Event portfolio and event-stage workflows
4. Layout approval and operational readiness
5. Staffing, Event Week execution, vendor operations, and live board
6. Venue-side couple collaboration, updates, and acknowledgments
7. Venue Portal quality gate and regression mapping
