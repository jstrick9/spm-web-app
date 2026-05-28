const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/db/migrations/0001_initial.sql';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "visibility      TEXT NOT NULL DEFAULT 'event'\n                  CHECK (visibility IN ('private','event','venue','public')),",
  "visibility      TEXT NOT NULL DEFAULT 'event'\n                  CHECK (visibility IN ('private','event','venue','public')),\n  approval_status TEXT NOT NULL DEFAULT 'draft'\n                  CHECK (approval_status IN ('draft','pending','approved','rejected')),"
);

fs.writeFileSync(path, code);
