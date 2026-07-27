# Venue Studio — Phase 1 Product Specification

## Goal

Enable non-technical venue owners and managers to create accurate, reusable scaffolds for ceremony, cocktail, reception, and outdoor/tent spaces. Couples and planners will use approved scaffolds as the protected base for event-specific layouts in Phase 2.

## User roles

| Role | Phase 1 capability |
|---|---|
| Venue owner/manager | Create, edit, approve, archive venue-space scaffolds; set measurements, constraints, imports, and reusable zones. |
| Planner | View approved scaffolds; prepare a future event-layout proposal in Phase 2. |
| Couple | View approved, guest-safe venue-space previews; request changes in Phase 2. |

Venue owner/manager is the final operational approver.

## Guided creation flow

1. Select space template: Ceremony, Cocktail, Reception, Outdoor/Tent.
2. Enter name, environment, units, width, height, and capacity.
3. Add operational constraints: exits, accessible route, loading, restrooms, power, no-go zones.
4. Optionally import a reference underlay.
5. Calibrate scale with a known real-world distance.
6. Trace/adjust walls, doors, windows, and pillars.
7. Save a draft or approve the scaffold.

## Underlay import policy

Phase 1 accepts PNG, JPEG, PDF, SVG, and DXF as lockable reference underlays. Import is non-destructive: source file, scale, opacity, rotation, and calibration metadata are preserved. SVG may expose traceable vectors; DXF and PDF remain reference underlays in Phase 1. Editable vector conversion is deferred until the import parser can preserve units, layers, and line semantics safely.

## Canvas behavior

- Feet/inches and metric units
- Grid and snap controls
- Zoom/pan/reset
- Selection, move, resize, rotate, duplicate, delete
- Undo/redo
- Layers: Underlay, Structure, Operations, Future Event Layout
- Measurement labels and scale indicator
- Accessibility/egress/capacity warning panel

## Wedding-core templates

### Ceremony
Aisle, ceremony focal point, guest seating boundary, accessible aisle, processional entrance, exit.

### Cocktail
Bar, cocktail tables, food stations, circulation path, vendor/service zone, weather fallback marker.

### Reception
Head/sweetheart table, dance floor, bar, buffet/service, band/DJ stage, guest-table zone, cake, exits, accessible route.

### Outdoor/Tent
Tent boundary, weather fallback, generator/power, portable restrooms, ingress/egress, loading and vendor zones.

## Approval

Draft scaffolds can be edited by venue managers. Approved scaffolds remain the operational base and require a new revision before modification. Phase 2 will add planner/couple comments, proposed event layouts, compare view, and venue-final approval.

## Acceptance criteria

- A venue manager can create each wedding-core scaffold in under five minutes.
- Dimensions and capacity are explicit and persisted.
- A reference underlay is visible, lockable, scalable, and recoverable.
- Structural and operational zones persist independently from event layouts.
- Approved venue scaffolds cannot be changed without a revision.
- Mobile users can review but desktop/tablet is prioritized for authoring.
