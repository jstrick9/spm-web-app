# Phase 6 · Day 2 — Staff Operations

Phase 6 continues by connecting day-of execution down to explicit tasks, assigning logical responsibilities to event phases avoiding timeline clutter for abstract prep work.

## What's Built
- **`EventStaffTab`**: Implemented the main Staff dashboard inside the Event Detail wrapper analyzing the `staff_tasks` backend arrays.
  - Dynamically categorizes jobs strictly into `Pre-Event Prep`, `Day-Of Execution`, and `Post-Event Teardown` phases giving staff a clear bucket of immediate vs future duties.
  - Interactive status toggles allowing click-to-complete interactions natively patching the DB directly via `react-query` mutations.
- **`StaffTaskFormDialog`**:
  - Provides a comprehensive form schema capturing Phase, Priorities (`low` -> `critical`), descriptive text blocks, and dynamic length inputs mapping back into `estimated_minutes` integers for scheduling projections.
  - Enables granular editing and deleting for active task nodes.

## What's Next
- **Permissions**: Moving beyond standard setup by enabling specific view limitations relying on Phase 1 RBAC mapping where `staff` role users ONLY see assigned tasks rather than the full venue overview.
- **Dashboard Hub**: Build the overarching internal Dashboard screen extracting top-level widgets globally across the organization parsing `booking-conversion` and generic timeline metrics to wrap up Phase 7 goals.
