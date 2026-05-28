const fs = require('fs');

const path = 'spm-web-app/wedding-app/server/src/routes/guests.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "    const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });",
  "    const event = eventsRepo.findById(eventId);\n    if (!event) throw NotFound();\n\n    const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });"
);

fs.writeFileSync(path, code);
