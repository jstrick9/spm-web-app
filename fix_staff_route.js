const fs = require('fs');
const path = 'spm-web-app/wedding-app/server/src/routes/staff.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "return { tasks: staffTasksRepo.listForOrg(orgId, { eventId, status: status as never }) };",
  "const isManager = can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage');\n    const assignedTo = isManager ? undefined : req.auth!.userId;\n    return { tasks: staffTasksRepo.listForOrg(orgId, { eventId, status: status as never, assignedTo }) };"
);

fs.writeFileSync(path, code);
