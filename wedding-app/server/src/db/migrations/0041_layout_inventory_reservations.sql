-- Event-scoped inventory reservations. Quantities are released as soon as the event layout changes.
CREATE TABLE IF NOT EXISTS layout_inventory_reservations (
  id TEXT PRIMARY KEY,
  layout_id TEXT NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  override_reason TEXT,
  reserved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(layout_id, inventory_item_id)
);
CREATE INDEX IF NOT EXISTS idx_layout_inventory_event ON layout_inventory_reservations(event_id, inventory_item_id);
