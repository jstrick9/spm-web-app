const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/db/repos/staff.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "listForOrg(orgId: string, opts: { eventId?: string; status?: StaffTaskRow['status'] } = {}): StaffTaskRow[] {",
  "listForOrg(orgId: string, opts: { eventId?: string; status?: StaffTaskRow['status']; assignedTo?: string } = {}): StaffTaskRow[] {"
);

code = code.replace(
  "if (opts.status)  { sql += ` AND status = ?`;   params.push(opts.status); }",
  "if (opts.status)  { sql += ` AND status = ?`;   params.push(opts.status); }\n    if (opts.assignedTo) {\n      // Since assigned_staff is a JSON array of strings, we can use JSON_EACH in SQLite or a LIKE query.\n      // Since we just want to know if assignedTo is inside the JSON array:\n      sql += ` AND EXISTS (SELECT 1 FROM json_each(assigned_staff) WHERE value = ?)`;\n      params.push(opts.assignedTo);\n    }"
);

fs.writeFileSync(path, code);
