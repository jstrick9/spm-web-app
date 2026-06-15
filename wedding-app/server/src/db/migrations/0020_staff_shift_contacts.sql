-- Shift-level contact, radio/channel, and handoff fields independent of the registered user profile.
ALTER TABLE staff_shifts ADD COLUMN contact_name TEXT;
ALTER TABLE staff_shifts ADD COLUMN contact_phone TEXT;
ALTER TABLE staff_shifts ADD COLUMN contact_email TEXT;
ALTER TABLE staff_shifts ADD COLUMN radio_channel TEXT;
ALTER TABLE staff_shifts ADD COLUMN handoff_notes TEXT;
