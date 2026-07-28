-- Structured venue-owned layout inventory: dimensions and service-style seating capacities.
ALTER TABLE inventory_items ADD COLUMN spec TEXT NOT NULL DEFAULT '{}';
