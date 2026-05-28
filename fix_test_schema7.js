const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const staffRole = rolesRepo.createCustom({ organizationId: orgId, key: 'test_staff', name: 'Staff', createdBy: owner.id, hierarchy: 10 });\n    rolesRepo.updatePermissions(staffRole.id, ['staff.view']);",
  "const staffRole = rolesRepo.createCustom({ organizationId: orgId, key: 'test_staff', name: 'Staff', createdBy: owner.id, hierarchy: 10, permissions: ['staff.view'] as any[] });"
);

fs.writeFileSync(path, code);
