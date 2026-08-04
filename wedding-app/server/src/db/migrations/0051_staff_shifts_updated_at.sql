-- Migration 0051: staff_shifts is missing updated_at (MODULE-05 ST-03).
--
-- The original schema (0001) only gave staff_shifts a created_at column, but
-- staffShiftsRepo.update() has always written `updated_at = datetime('now')` —
-- meaning every PATCH to /api/staff/shifts/:id threw
-- "no such column: updated_at" → 500. Add the column so reschedules persist.
ALTER TABLE staff_shifts ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));
