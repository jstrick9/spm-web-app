# Venue Space Creation UX Review

**Reviewed repositories:**
- Legacy reference: `jstrick9/wedding-venue-app-old` (main, reviewed July 28, 2026)
- Current product: `jstrick9/spm-web-app`

## Executive recommendation

The current product has substantial Venue Studio foundations—versioned approved scaffolds, reference underlays, units/grid/snap, operational zones, exports, collaboration, and an event-object palette—but the creation journey is still tool-first. A nontechnical venue manager should not need to understand a drawing canvas in order to create a usable ceremony lawn, ballroom, cocktail terrace, or tent plan.

Build **Venue Space Setup** as a guided, three-path experience above the advanced builder:

1. **Start with a wedding template**
2. **Upload a reference plan**
3. **Measure the space**

The user chose to offer all three paths, use independent spaces with optional property-map connections, limit couple/planner edits to furniture/tables/chairs/decor, and optimize initial creation for on-site measurements.

The advanced canvas remains available as an “Edit details” tool for trained venue staff; it must not be the first or only way to create a space.

---

## What the legacy app does well

The legacy repository is a React/Vite application with a broad venue-layout domain model. It contains useful product ideas that should inform—not be copied into—the current product.

### 1. It models venue-space attributes explicitly

The legacy `Venue` model includes physical dimensions, canvas dimensions, interior/exterior padding, custom polygon shape points, indoor architectural features, outdoor features, capacity, and category. This is the correct conceptual direction: a venue space is more than a blank drawing.

### 2. It distinguishes permanent space features from event layout objects

Its model separates venue architecture (doors, windows, columns, stages, bar counters, paths, trees, parking, etc.) from tables/fixtures/decor/guests. This matches wedding operations well:

- **Venue-owned scaffold:** walls, doors, columns, exits, utilities, fixed bars, load-in, restrooms, weather constraints.
- **Event-owned proposal:** tables, chairs, dance floor, portable bar, ceremony seating, decor, linens, floral, signage.

The current product should preserve and strengthen this boundary.

### 3. It offers custom-shape primitives and shape templates

`CustomVenueBuilder` has simple footprint presets (rectangle, beveled, trapezoid, pavilion, angled, courtyard), grid/snap options, numeric point controls, and a live SVG shape preview. The idea of selecting a recognizable footprint before fine editing is useful.

### 4. It contains operationally relevant catalog concepts

The legacy data set includes wedding-relevant furniture, chair styles, table specs, indoor fixtures, outdoor features, spacing settings, decor items, and templates. These are better starting points than generic drawing primitives.

### 5. It attempts collision, capacity, and spacing validation

The legacy app includes collision/spacing helpers and capacity awareness. In a wedding layout product, design needs operational validation—not merely visual placement.

---

## Why the legacy setup is not the target interaction

The legacy app is not a model to reproduce as the primary creation experience.

### A. It is fragmented

Venue creation, custom shape editing, freehand drawing, floor-plan layout, decor design, templates, fixtures, and admin management are separate experiences. A venue manager has to know where each task belongs.

### B. Its `DrawingTool` is a generic raster illustration tool

The component is effectively a 500×400 pixel paint program with pen, brush, spray, shapes, fill, eyedropper, text, and eraser. It saves an image plus generic drawing objects. That is unsuitable for accurate, maintainable venue scaffolds because:

- freehand/raster work has no dependable physical measurement model;
- “walls” are not semantic building objects with thickness, openings, or constraints;
- it is hard to edit after the fact;
- generic art tools overwhelm nontechnical users;
- it creates a mismatch with later tables, chairs, operational zones, and exports.

### C. Shape creation requires CAD-like mental models

The custom builder exposes polygon points, vertex selection, insertion, nudges, normalized coordinate math, and a separate save step. This can be useful as an advanced repair tool, but it should not be the default for wedding venue staff.

### D. Catalog placement is interaction-heavy

The legacy floor plan depends heavily on sidebar browsing and drag/drop. For a banquet team setting up 18 rounds, 180 chairs, a head table, dance floor, ceremony focal point, and bar, repeated single-object placement is slow and error-prone.

### E. Critical wedding workflow is not front-loaded

A wedding space starts with guest count, service style, ceremony/reception intent, fixed constraints, access, weather/rain plan, and operational flows. Those decisions should drive the initial scaffold and suggested plan before users touch a canvas.

### F. Architecture is not an appropriate foundation to reuse

The legacy app is primarily client-side and persists much state through browser storage, with optional Supabase services. The current product already has stronger first-class venue records, server permissions, versioning, approval, event layouts, and audit workflows. Migrate product ideas only; do not migrate the old persistence/design architecture.

---

## Current product: what already exists

The current Venue Studio has the right backend and most important primitives:

- first-class, versioned venue scaffolds;
- ceremony, cocktail, reception, and outdoor/tent starting templates;
- dimensions and imperial/metric unit systems;
- a draft → venue-approved scaffold lifecycle;
- event layouts that instantiate only from approved scaffolds;
- image/PDF underlays, including retained original PDFs and raster tracing previews;
- walls, doors, windows, pillars, operational zones, grid/snap, calibration, SVG/DXF imports, PNG/PDF output;
- event collaboration/review APIs and venue approval controls;
- a quick event-design palette for tables, chairs, decor, ceremony items, bars, dance floors, and stages.

The key gap is **orchestration**: the user needs a simple, guided way to turn a measured real-world room into a trusted reusable venue space before being shown advanced editing tools.

---

## Target product model

### Two connected layers

#### 1. Venue Space (venue-managed, reusable, protected)

A physical area such as “Grand Ballroom,” “Garden Lawn,” “Oak Terrace,” or “Rain Plan Ballroom.”

Contains:

- name, space type, environment, dimensions, capacity;
- fixed perimeter/footprint and architectural features;
- doors, windows, columns, built-in bar/stage/fireplace/restrooms;
- emergency exits, accessible routes, power, loading, service access, fire-lane restrictions;
- approved measurement/reference source and calibration;
- venue rules: max occupancy, table limits, noise/end times, candle policy, tent rules, permitted layouts;
- version history and venue manager approval.

Only venue owner/manager and authorized staff can edit these elements.

#### 2. Event Layout (event-specific, proposal-capable)

A wedding’s use of an approved space.

Contains:

- tables, chairs, lounge groupings, dance floor, portable bar, DJ/band, ceremony seating, photo booth, floral/decor, signage, linen/style selections;
- proposal notes and comments;
- operational overlays (guest arrival, processional, couple entrance, service, vendor load-in, egress);
- quantities, inventory use, setup instructions;
- planner/couple proposal status and final venue approval.

Couples/planners may add and arrange furniture, tables, chairs, and decor but cannot change permanent architecture, capacity, egress, utility, accessibility, or other venue-protected constraints.

---

## Recommended primary UI: Venue Space Setup

### Entry screen: “How would you like to start?”

Show three large, visually distinct cards, not a blank canvas:

1. **Use a wedding space template**
   - Best for a new/standard space or a quick first draft.
   - Ceremony, cocktail hour, reception, outdoor/tent, rehearsal dinner, and custom.

2. **Upload a floor plan or photo**
   - PDF, image, SVG/DXF; retain source and create a tracing/reference preview.
   - Clearly state: “We will use this as a locked reference. You can add accurate dimensions next.”

3. **Measure the space** *(recommended default based on the user’s answer)*
   - A phone-friendly, plain-language measurement checklist.
   - “You can improve this later with a floor plan.”

A recommendation chip can guide selection: “Recommended: Measure the space” for a first-time venue without a plan.

### Step 1: Identify the space

Ask only the questions needed to generate a good starter model:

- Space name
- What happens here? Ceremony / cocktail / reception / outdoor/tent / multi-use
- Indoor, outdoor, or tent
- Typical guest count and maximum permitted occupancy
- Main service style: plated, buffet, stations, cocktail reception, ceremony seating
- Is this a rain-plan space? If yes, link the primary outdoor space.

### Step 2: Measure and outline

Use a **room card workflow**, not a drawing mode:

- choose footprint: rectangle, L-shape, courtyard, tent, lawn/open boundary, custom;
- enter length × width (feet/inches or meters);
- for L-shape: enter two rectangles; for a tent: choose common tent size/pole pattern;
- show a scaled live preview and estimated usable square footage;
- “Add a notch / alcove” as a guided action rather than raw polygon editing;
- permit advanced “Edit outline” only after creation.

For on-site measurement, guide the user with a checklist:

1. Stand at the main guest entrance.
2. Measure longest wall and adjacent wall.
3. Mark doors, windows, columns, built-in bar/stage.
4. Mark exit doors, accessible path, power, loading/service entry.
5. Add a quick photo for each wall/feature.

Include confidence/status: **Approximate / Measured / Verified against plan / Venue approved**.

### Step 3: Add fixed features with guided placement

Use a concise “Add permanent features” panel:

- doors and entrances;
- windows;
- columns/pillars;
- built-in stage/bar/fireplace;
- restrooms and stairs/elevator (as adjacent-space links);
- exits, accessible routes, power, loading, service zones.

Interaction rules:

- click an edge to place a door/window; it snaps to the wall;
- click inside the space to place a column or fixed feature;
- show a simple dimension label while moving;
- auto-snap to corners, center lines, and nearby features;
- provide a direct numeric field for exact location;
- make all permanent features obviously locked after approval.

### Step 4: Operational readiness, not just drawing

Show a completion checklist with useful wedding language:

- guest entrance and processional entry identified;
- two clear exits/egress routes where applicable;
- accessible route marked;
- power and cable route identified;
- catering/service/load-in path marked;
- restroom direction/adjacency recorded;
- weather/rain-plan link recorded for outdoor spaces;
- capacity verified;
- venue rules added.

Use a plain readiness score with exactly what remains, e.g. “4 of 6 essential details complete: add an exit, accessible route, and service entry.”

### Step 5: Review and approve reusable scaffold

Before approval, show an understandable summary:

- dimensions, useable area, capacity, source confidence;
- permanent features count;
- safety/operations checklist;
- version comparison;
- who approved it and date;
- spaces connected to it (optional property-map links).

Only after venue approval can it be used for event layouts.

---

## Optional connected property map

The chosen model is **independent spaces by default with optional connections**. Implement a lightweight “Property connections” panel after a space is saved:

- connect spaces by guest transition: Ceremony Lawn → Cocktail Terrace → Ballroom;
- mark travel time/distance and accessibility status;
- designate indoor rain-plan counterpart;
- identify shared loading, parking, restrooms, power source, and emergency access;
- do not force users to build a whole property map before making one room.

This is particularly valuable for real wedding operations because guest flow, vendor transitions, bar placement, and rain contingencies span spaces.

---

## Event layout UX for couple/planner proposals

### Proposal-safe editing

The user chose **furniture, tables, chairs, and decor** for couple/planner access. Implement a clear role boundary:

| Element | Venue manager | Planner/couple |
|---|---:|---:|
| Space perimeter, dimensions | edit | view only |
| Doors/exits/power/accessibility | edit | view only |
| Capacity and venue rules | edit | view only |
| Tables/chairs | edit | add/move/remove as proposal |
| Decor/floral/signage | edit | add/move/remove as proposal |
| Portable bar/DJ/dance floor | edit | propose, subject to validation |
| Final approval | yes | request only |

### Better object workflow

The current quick palette is a good first step. Extend it with **quantity-first placement**:

- “Add 18 round tables for 8” creates a suggested grid/cluster instead of requiring 18 clicks.
- “Add 180 chairs” seats tables automatically based on capacity/seat count.
- “Add ceremony seating for 150” offers rows, center aisle width, reserved seats, and processional placement.
- “Add reception essentials” creates a configurable dance floor, sweetheart/head table, DJ/stage, bar, cake, gift/card table, photo booth, and catering/service zone.
- “Add cocktail setup” suggests highboys, bars, food stations, lounge groups, and circulation paths.

Every suggestion must be editable and never silently overwrite an approved plan.

### Design modes

Use task-oriented modes rather than generic tools:

1. **Guest seating** – tables, chairs, counts, assignment.
2. **Ceremony** – aisle, seating rows, focal point/arch, processional, reserved seating.
3. **Reception** – tables, dance floor, head/sweetheart table, bar, DJ/band, cake, photo booth.
4. **Decor** – floral, linens, lighting, drape, signage, lounge, rentals.
5. **Operations** – read-only for planners/couples; venue staff manages service, exits, power, loading, vendor access.

---

## Drawing/canvas improvements required

### Replace freehand-first behavior

Do not expose paint-style pen/brush/eraser tools in normal venue creation. They look flexible but create inaccurate, non-semantic plans.

### Provide direct manipulation that behaves predictably

- one active tool at a time with visible cursor/state;
- click-to-place is the primary interaction; drag-and-drop is optional;
- touch support and large hit areas;
- snap settings with a plain label: “Snap objects to 1 ft grid”;
- alignment guides, center lines, equal spacing, distribute, duplicate, rotate 90°;
- numeric inspector for x/y/width/height/rotation, always in the selected unit system;
- keyboard shortcuts only as acceleration, never required;
- undo/redo per object operation with visible change labels;
- selected object gets handles, dimensions, and a simple action strip: Duplicate, Rotate, Delete, Lock.

### Support speed at banquet scale

- table presets include seating capacity and clearance;
- bulk placement, rows, arcs, grids, and “fill this zone”;
- automatic chairs around tables with adjustable count;
- group/ungroup, duplicate row, copy/paste style;
- saved “venue favorites” and “wedding packages” that include object quantities and style.

### Separate visual layers

Use visible, lockable layers:

1. Reference plan
2. Building / permanent structure
3. Safety & operations
4. Event furniture
5. Decor
6. Notes / comments

The default view for a couple/planner should focus on Event furniture + Decor, with protected layers dimmed and locked.

---

## Wedding-specific operational intelligence

A market-leading venue product should guide operations without pretending to replace local code/fire-marshal review.

### Design warnings

Flag rather than silently block:

- capacity exceeds venue limit;
- table/chair count does not support guest count;
- aisle, accessible route, exit, or service path appears obstructed;
- dance floor too small for expected guest count;
- bar count/location is inconsistent with guest count and service duration;
- buffet/station queues encroach on circulation;
- power-dependent items lack a nearby designated power zone;
- outdoor plan lacks a rain-plan link;
- tent plan lacks entrance, generator/power, catering, restroom, or weather details.

Warnings should state the reason and an action: “Move this table 3 ft left,” “Add a second bar,” “Review with venue manager.”

### Practical wedding templates

For each space type, provide starter plans with adjustable guest count and service style:

- ceremony: straight/curved/semicircle seating, aisle, arch/focal point, musicians, reserved family;
- cocktail: bars, highboys, stations, lounge, entertainment, circulation;
- reception: plated, buffet, stations, family-style, indoor/outdoor transition;
- outdoor/tent: tent footprint, poles, dance floor, generator/power, weather fallback, restroom, service/loading;
- rehearsal dinner and welcome party: communal, rounds, lounge, presentation.

### Approval packet

Final approval should produce a clear setup packet with:

- scaled plan and legend;
- object and rental quantities;
- venue-protected constraints;
- setup sequence/load-in details;
- accessible and emergency route overlay;
- version/date/approver;
- change summary from prior approved plan;
- vendor-specific filtered views.

---

## Collaboration and approval improvements

The current collaboration foundation should become a focused review experience:

1. **Proposal status:** Draft → Submitted for venue review → Changes requested → Approved / Rejected.
2. **Pins attached to objects or coordinates:** “Move bar away from this exit,” not a generic text thread.
3. **Resolve workflow:** author responds; venue manager resolves/reopens; resolution is in audit history.
4. **Revision comparison:** overlay/diff the prior approved plan and the proposal, showing added/removed/moved objects.
5. **Approval queue:** venue manager sees event, space, requester, readiness warnings, changed objects, and one-click approve/request changes.
6. **Immutable approved revision:** new edits branch a proposal; they do not mutate approved operational instructions.

---

## Implementation sequence

### Phase A — Creation flow (highest priority)

1. Build the three-path **Venue Space Setup** entry screen.
2. Build measurement-first room-card creation with rectangle/L-shape/tent/open-boundary presets.
3. Add guided permanent-feature placement and readiness checklist.
4. Keep the existing advanced Venue Builder behind “Edit details.”
5. Create/update tests for each creation path and protected scaffold behavior.

### Phase B — Event design speed

1. Upgrade quick palette into quantity-first placement and wedding setup presets.
2. Add auto seating around tables, bulk rows/grid/arc placement, and package-based layouts.
3. Lock venue-owned structure and operational layers for planner/couple roles.
4. Add object quantities and inventory/rental summary.

### Phase C — Review and operations

1. Object-pinned comments and comment resolution.
2. Proposal status and venue approval queue.
3. Side-by-side/overlay revision comparison.
4. Setup packet improvements and role/vendor filtered exports.

### Phase D — Advanced drafting/import

1. Better SVG path/transforms and DXF block/scale/layer support.
2. Source-reference calibration workflow.
3. Advanced footprint editor only for venue staff.
4. Optional 3D/immersive visualization after the 2D workflow is reliable.

---

## Success measures

Track whether the product is actually easier:

- Median time for a manager to create an approved measured space.
- Percentage of new spaces created without entering advanced drawing mode.
- Time to make a 150-guest reception proposal.
- Number of review cycles before approval.
- Percentage of layouts with all readiness essentials complete.
- Setup-day variance and number of last-minute layout changes.
- Planner/couple completion rate without staff intervention.

## Bottom line

The product should feel like a wedding venue setup concierge, not CAD software and not a generic paint application. Start with intent and measured reality, generate a dependable venue scaffold, make event design fast through wedding-aware quantities and packages, keep venue safety/operations protected, and make final approval unmistakable.
