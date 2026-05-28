const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "staffTasksRepo.create(orgId, 'owner', { title: 'Admin Task', assignedStaff: [] });\n    staffTasksRepo.create(orgId, 'owner', { title: 'Staff Task', assignedStaff: [staffId] });",
  "staffTasksRepo.create(orgId, owner.id, { title: 'Admin Task', assignedStaff: [] });\n    staffTasksRepo.create(orgId, owner.id, { title: 'Staff Task', assignedStaff: [staffId] });"
);

fs.writeFileSync(path, code);
