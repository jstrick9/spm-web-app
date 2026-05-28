# Phase 4 · Day 4 — Guest Canvas Assignments

We have enhanced the Canvas architecture by hooking into HTML5 drag-and-drop mechanics to support assigning physical guests (imported via the Guests tool) to visual map chairs.

## What's Built
- **Guests Sidebar**: The `CanvasPage` sidebar now features a primary sub-navigation toggling between the design **Catalog** and the **Guests** panel.
- **Assignment Logic**:
  - The Guests panel dynamically executes a live `layoutsSdk.list` fetch pulling the actual event manifest.
  - Automatically diffs layout objects vs guest schemas sorting out `unassigned` counts!
  - Built custom `HTML5` drag-events wrapping the sidebar entities and injecting data directly into the `<Stage>` scope matching cursor coordinates.
- **Seat Mapping**: 
  - Draggable bounds detection maps HTML coordinates cleanly through the Konva `scale` matrix applying the guest to the nearest matching `<Circle>` element (classified as `chair`).
  - Added Double-Click events clearing `guestId` mappings.
- **Graphical Re-Painting**: Added color-bindings so `<Circle>` chair components intelligently fill with highlighted colors and stamp the user's graphical initials (e.g. `JS`) onto the canvas shape upon successful drop.

## What's Next
- **Revision History**: Since mutations are bound purely to JSON payloads, we can build a version control UI mapping server layouts for "Undo" functionality across design states.
- **Rotations Tool**: Planners require interactive methods beyond simple catalog spawn to turn Rect tables to angled layouts. 
