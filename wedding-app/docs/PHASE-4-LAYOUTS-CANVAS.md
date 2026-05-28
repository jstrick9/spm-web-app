# Phase 4 - Layouts Canvas

Now that Phase 3 design/themes are set and Phase 1-2 have built the backend and basic tables, Phase 4 focuses on the highly interactive floor-plan canvas. 

## Scope
- Draggable, rotatable tables, chairs, dance floors, walls
- Optimistic concurrent saves to the server (`/api/layouts/:id`)
- Drag-and-drop guest table assignment (linking guests to seats)
- Canvas panning and zooming
- Revision history (undo/redo locally, full version list from server)

## Architecture decision
- Use `react-konva` for high-performance canvas rendering.
- Maintain a local state store for rapid interactions.
- Sync state mutations via the `syncMonitor` queue in the background.

