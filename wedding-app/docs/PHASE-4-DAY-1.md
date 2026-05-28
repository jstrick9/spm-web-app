# Phase 4 · Day 1 — Canvas Foundation Complete

We have established the interactive canvas foundation using `react-konva`. The `CanvasPage` provides a performant surface for laying out wedding elements like tables, chairs, and dance floors.

## What's Built
- **`CanvasPage` Integration**: Inserted into the `EventDetail` Layout tab replacing the placeholder.
- **Konva Engine**: Configured `Stage`, `Layer`, `Group`, `Rect`, and `Circle` components.
- **Zoom & Pan**: Added mouse-wheel zoom tracking around the cursor and full-stage drag panning.
- **Entity State**: Setup initial layout state structure capturing positional (`x`,`y`), structural (`width`, `height`, `radius`), rotational (`rotation`), and type variables (`round_table`, `rect_table`, `dance_floor`, `chair`).
- **Drag & Drop Logic**: Bound `onDragEnd` events to sync node mutations with the React state model.

## What's Next
- **Save/Load from DB**: Tie the layout objects to the backend `layoutsRepo`.
- **Canvas Toolbar**: Introduce functional UI tools to insert new items and rotate selected components.
- **Guest Assignment**: Provide logic to attach imported guests to individual seats visually on the canvas.
