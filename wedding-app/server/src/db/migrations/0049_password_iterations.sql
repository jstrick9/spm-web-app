-- Migration 0049: record PBKDF2 iteration count per user password.
-- NULL = legacy work factor (120,000); new hashes use 600,000 (OWASP-recommended).
-- Existing hashes are transparently re-verified with the legacy factor and
-- upgraded on the user's next successful login (rehash-on-login).
ALTER TABLE users ADD COLUMN password_iterations INTEGER;
