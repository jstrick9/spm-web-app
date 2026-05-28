# Phase 6 · Day 3 — Staff RBAC & Isolation

In Day 3, we locked down the visibility scope so explicit event roles (like limited `staff` accounts) ONLY see the tasks relevant to them. 

## What's Built
- **Staff Repository Overhaul**:
  - Updated `staffTasksRepo.listForOrg` to accept an `assignedTo` query option.
  - Leveraged SQLite JSON tree mapping utilizing the powerful `EXISTS (SELECT 1 FROM json_each(assigned_staff) WHERE value = ?)` query architecture. This safely scales parsing an arbitrary number of assigned users over strings.
- **Access Route Guarding**:
  - Bound dynamic evaluation in `GET /api/orgs/:orgId/staff/tasks`.
  - Determines if `req.auth!.userId` possesses the global `staff.manage` permission. If so, returns *all* tasks; otherwise, limits the extraction exclusively targeting rows where they appear in the `assigned_staff` array.
- **Extensive Integration Tests**:
  - Verified edge-cases utilizing `vitest` covering exact user isolation. An Admin properly retrieves their global lists while Staff are correctly walled into retrieving only `Staff Task`.

## What's Next
This successfully closes the logistical timeline mapping requirements. We are ready for **Phase 7: Dashboarding & Systems** to create organizational performance tiles connecting all datasets natively directly on the home page!
