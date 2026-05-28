const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.integration.test.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "usersRepo.create({ email: 'owner@test.com', passwordHash: 'x', passwordSalt: 'x' })",
  "usersRepo.create({ email: 'owner@test.com', fullName: 'Owner', passwordHash: 'x', passwordSalt: 'x' })"
);

code = code.replace(
  "usersRepo.create({ email: 'staff@test.com', passwordHash: 'x', passwordSalt: 'x' })",
  "usersRepo.create({ email: 'staff@test.com', fullName: 'Staff', passwordHash: 'x', passwordSalt: 'x' })"
);

fs.writeFileSync(path, code);
