const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "let staffId: string;",
  "let staffId: string;\n  let ownerId: string;"
);

code = code.replace(
  "const owner = usersRepo.create({ email: 'owner@test.com', fullName: 'Owner', passwordHash: 'x', passwordSalt: 'x' });",
  "const owner = usersRepo.create({ email: 'owner@test.com', fullName: 'Owner', passwordHash: 'x', passwordSalt: 'x' });\n    ownerId = owner.id;"
);

code = code.replace(
  "staffTasksRepo.create(orgId, owner.id, { title: 'Admin Task', assignedStaff: [] });\n    staffTasksRepo.create(orgId, owner.id, { title: 'Staff Task', assignedStaff: [staffId] });",
  "staffTasksRepo.create(orgId, ownerId, { title: 'Admin Task', assignedStaff: [] });\n    staffTasksRepo.create(orgId, ownerId, { title: 'Staff Task', assignedStaff: [staffId] });"
);

fs.writeFileSync(path, code);
