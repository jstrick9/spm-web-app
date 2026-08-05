-- Migration 0053: direct_messages.sender_id must accept non-user senders.
--
-- The vendor portal sends messages with sender_id = vendor.id (sender_role
-- 'vendor'); the original FK (sender_id REFERENCES users(id) ON DELETE
-- CASCADE) rejected every such insert, so vendor portal messages ALWAYS
-- returned 500 internal-error. Rebuild the table without the users FK —
-- sender_role already discriminates ('vendor' vs 'couple'/'manager'/'planner').
-- User-sender integrity is enforced by the app layer (every other caller
-- passes req.auth!.userId).
PRAGMA foreign_keys = OFF;

CREATE TABLE direct_messages_new (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,
  sender_id   TEXT NOT NULL,
  sender_role TEXT NOT NULL,
  body        TEXT NOT NULL,
  read_by     TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO direct_messages_new (id, thread_id, sender_id, sender_role, body, read_by, created_at)
  SELECT id, thread_id, sender_id, sender_role, body, read_by, created_at FROM direct_messages;
DROP TABLE direct_messages;
ALTER TABLE direct_messages_new RENAME TO direct_messages;
CREATE INDEX IF NOT EXISTS idx_direct_messages_thread ON direct_messages(thread_id, created_at);

PRAGMA foreign_keys = ON;
