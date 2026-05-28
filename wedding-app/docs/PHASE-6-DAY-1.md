# Phase 6 · Day 1 — Timeline (Run of Show) Editor

Phase 6 shifts the focus to day-of event execution logic. We begin by swapping the placeholder Timeline tab with a fully functional visual "Run of Show" editor allowing planners to sequence events dynamically.

## What's Built
- **`EventTimelineTab`**: Replaced the 'Coming Soon' placeholder tab with a real day-of schedule renderer. 
  - Extracts `sdk.timeline.list` dynamically structuring response datasets sorted intuitively by `starts_at` time logic utilizing `date-fns` formatting.
  - Implemented visually distinct toggle-bubbles acting as completion checks dynamically mutating via the `toggleStatus` integration natively dispatching patches to the backend schema.
- **`TimelineItemFormDialog`**: Integrated a standard Zod-validated creation and editing wizard exposing configurations:
  - Event title
  - Scheduled time (compiles user-local strings dynamically down to proper backend ISO timestamps).
  - Duration metrics.
  - Categorization.
  - Optional `notes` serialized directly into the JSON metadata payload.
- **Testing & E2E Validation**: Configured specific React Query wrapping validating sorting configurations and creation invocations passing fully through Vitest CI pipelines. 

## Phase 6 Next Steps
- **Staff / Role Assignments**: Tying these exact Timeline events strictly down to `sys_staff` assignments defining precisely *who* handles which scheduled action!
