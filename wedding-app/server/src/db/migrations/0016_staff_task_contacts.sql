-- Staff task day-of contact fields for quick call/SMS actions.
-- These fields are intentionally denormalized on the task so day-of run sheets
-- and offline/mobile views can show the exact escalation contact even when the
-- assignee is not a registered user.

ALTER TABLE staff_tasks ADD COLUMN assignee_name  TEXT;
ALTER TABLE staff_tasks ADD COLUMN assignee_phone TEXT;
ALTER TABLE staff_tasks ADD COLUMN assignee_email TEXT;
