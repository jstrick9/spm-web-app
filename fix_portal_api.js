const fs = require('fs');

const path = 'spm-web-app/wedding-app/server/src/routes/guests.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import {",
  "import {\n  auditRepo, eventsRepo, guestsRepo, rsvpRepo, portalConfigRepo, layoutsRepo"
);

// If layoutsRepo isn't there, let's fix it by regex on the imports
code = code.replace(
  /import \{(.*?)\} from '\.\.\/db\/repos\/index\.js';/s,
  "import { $1, layoutsRepo } from '../db/repos/index.js';"
);

// Update guestList map
code = code.replace(
  ".map((g) => ({ id: g.id, fullName: g.full_name }));",
  ".map((g) => ({ id: g.id, fullName: g.full_name, tableAssignment: g.table_assignment, seatAssignment: g.seat_assignment }));"
);

const layoutQuery = `
    const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });
    const layout = layouts.length > 0 ? layouts[0] : null;
    let layoutPayload = null;
    if (layout) {
       try { layoutPayload = typeof layout.payload === 'string' ? JSON.parse(layout.payload) : layout.payload; } catch {}
    }
`;

code = code.replace(
  "return {",
  layoutQuery + "\n    return {\n      layout: layoutPayload,"
);

fs.writeFileSync(path, code);
