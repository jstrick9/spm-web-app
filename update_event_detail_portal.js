const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { CanvasPage } from './layouts/CanvasPage';",
  "import { CanvasPage } from './layouts/CanvasPage';\nimport { GuestPortalSettingsTab } from './portal/GuestPortalSettingsTab';"
);

code = code.replace(
  "<TabsContent value=\"portal\">\n            <ComingSoon title=\"Guest Portal\" description=\"Day 4 of Week 1 — public RSVP page configuration.\" />\n          </TabsContent>",
  "<TabsContent value=\"portal\">\n            <GuestPortalSettingsTab eventId={eventId} />\n          </TabsContent>"
);

fs.writeFileSync(path, code);
