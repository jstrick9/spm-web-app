-- Add clock-in/out support to staff_shifts
ALTER TABLE staff_shifts ADD COLUMN clocked_in_at TEXT;
ALTER TABLE staff_shifts ADD COLUMN clocked_out_at TEXT;
