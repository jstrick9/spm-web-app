const fs = require('fs');

const path = 'spm-web-app/wedding-app/server/src/db/migrations/0001_initial.sql';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "CHECK (answer_type IN ('dropdown','integer','text'))",
  "CHECK (answer_type IN ('dropdown','integer','text','date','boolean','multiselect'))"
);

fs.writeFileSync(path, code);

// Need to run migrations logic - actually, existing databases will be corrupted by CHECK constraint
// We will drop and recreate for local dev to avoid migration hassle, but a proper migration would ALTER TABLE.
