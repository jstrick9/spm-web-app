const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { EventVendorsTab } from './vendors/EventVendorsTab';",
  "import { EventVendorsTab } from './vendors/EventVendorsTab';\nimport { EventTimelineTab } from './timeline/EventTimelineTab';"
);

code = code.replace(
  "<TabsContent value=\"timeline\">\n            <ComingSoon title=\"Timeline\" description=\"Week 8 — drag-and-drop day-of schedule editor.\" />\n          </TabsContent>",
  "<TabsContent value=\"timeline\">\n            <EventTimelineTab eventId={eventId} />\n          </TabsContent>"
);

fs.writeFileSync(path, code);
