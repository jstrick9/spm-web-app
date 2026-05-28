# Phase 4 · Day 2 — Backend Layout Sync

Day 2 introduces the complete integration between the `CanvasPage` and the `layoutsRepo` utilizing React Query.

## What's Built
- **`layoutsSdk` Hooks**: Integrated the fetching logic wrapping `sdk.layouts.list` allowing the specific event canvas to query any saved remote models.
- **Initial Setup State**: Added effect hooks handling default fallback canvas state (e.g. 2 round tables, 1 rect table, a dancefloor) when an event hasn't explicitly saved a layout yet. Otherwise, extracts and binds the database `payload.items` directly to the `CanvasPage`'s internal map.
- **Concurrent Auto-Saving / Creating**: 
  - Tracks user mutation bounds setting `hasChanges`.
  - Determines via existing `layout` variables whether to branch a `createLayout` POST (upserting) or `saveLayout` PATCH action.
  - Button state syncs gracefully with the `isPending` locks from standard `useMutation` hooks avoiding conflict races while dragging.
- **Testing**:
  - Bound complex mocks covering `<canvas>` contexts allowing `Konva` objects to assert cleanly in non-browser Node environments (via jsdom).
  - Wrote explicit `CanvasPage.test.tsx` verifying renders and interaction.

## What's Next (Day 3)
- **Visual Toolbar Sidebar**: Moving the raw buttons ("Add table") into a dedicated side-panel exposing all table styles, decor items, plants, and chair variations.
- **Guest Dropping**: Provide an interactive drag-drop interface grabbing imported users from the `<EventGuestsTab>` and snapping them sequentially onto grouped `<Circle>` objects indicating open seat status!
