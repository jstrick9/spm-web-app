const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "orgsRepo.addMember(orgId, staff.id, staffRole.id);",
  "orgsRepo.addMember({ orgId, userId: staff.id, roleId: staffRole.id });"
);

fs.writeFileSync(path, code);
