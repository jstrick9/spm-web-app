const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { EventGuestsTab } from './guests/EventGuestsTab';\nimport { CanvasPage } from './layouts/CanvasPage';",
  "import { EventGuestsTab } from './guests/EventGuestsTab';\nimport { CanvasPage } from './layouts/CanvasPage';\nimport { EventVendorsTab } from './vendors/EventVendorsTab';"
);

code = code.replace(
  "<TabsContent value=\"vendors\">\n            <ComingSoon title=\"Vendors\" description=\"Weeks 5-6 — full Vendor Management System with vendor portal.\" />\n          </TabsContent>",
  "<TabsContent value=\"vendors\">\n            <EventVendorsTab eventId={eventId} organizationId={event.organization_id} />\n          </TabsContent>"
);

fs.writeFileSync(path, code);
