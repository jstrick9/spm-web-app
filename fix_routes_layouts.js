const fs = require('fs');

const path = 'spm-web-app/wedding-app/server/src/routes/layouts.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "expectedRevision:  z.number().int().min(1).optional(),",
  "expectedRevision:  z.number().int().min(1).optional(),\n  approvalStatus:    z.enum(['draft','pending','approved','rejected']).optional(),"
);

code = code.replace(
  "expectedRevision: parsed.data.expectedRevision,",
  "expectedRevision: parsed.data.expectedRevision,\n        approvalStatus: parsed.data.approvalStatus,"
);

fs.writeFileSync(path, code);
