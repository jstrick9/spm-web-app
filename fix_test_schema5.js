const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const { seedSystemRoles } = await import('../db/seed.js'); seedSystemRoles();",
  "const { rolesRepo } = await import('../db/repos/index.js'); rolesRepo.ensureSystemRoles();"
);

fs.writeFileSync(path, code);
