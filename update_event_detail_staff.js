const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { EventTimelineTab } from './timeline/EventTimelineTab';",
  "import { EventTimelineTab } from './timeline/EventTimelineTab';\nimport { EventStaffTab } from './staff/EventStaffTab';\nimport { ClipboardCheck } from 'lucide-react';"
);

code = code.replace(
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'layout' | 'portal' | 'settings';",
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'staff' | 'layout' | 'portal' | 'settings';"
);

code = code.replace(
  "<TabsTrigger value=\"vendors\"><Truck className=\"h-3.5 w-3.5 mr-1\" />Vendors</TabsTrigger>",
  "<TabsTrigger value=\"vendors\"><Truck className=\"h-3.5 w-3.5 mr-1\" />Vendors</TabsTrigger>\n            <TabsTrigger value=\"staff\"><ClipboardCheck className=\"h-3.5 w-3.5 mr-1\" />Staff</TabsTrigger>"
);

code = code.replace(
  "</TabsContent>\n\n          <TabsContent value=\"layout\">",
  "</TabsContent>\n\n          <TabsContent value=\"staff\">\n            <EventStaffTab eventId={eventId} organizationId={event.organization_id} />\n          </TabsContent>\n\n          <TabsContent value=\"layout\">"
);

fs.writeFileSync(path, code);
