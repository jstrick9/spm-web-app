const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const staffRole = rolesRepo.create({ organizationId: orgId, key: 'test_staff', name: 'Staff', isSystem: false, hierarchy: 10 });",
  "const staffRole = rolesRepo.createCustom({ organizationId: orgId, key: 'test_staff', name: 'Staff', createdBy: owner.id, hierarchy: 10 });"
);

fs.writeFileSync(path, code);
