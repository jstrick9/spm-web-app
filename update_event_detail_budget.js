const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { ChatSystem } from './chat/ChatSystem';",
  "import { ChatSystem } from './chat/ChatSystem';\nimport { EventBudgetTab } from './budget/EventBudgetTab';\nimport { DollarSign } from 'lucide-react';"
);

code = code.replace(
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'staff' | 'layout' | 'chat' | 'portal' | 'settings';",
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'budget' | 'staff' | 'layout' | 'chat' | 'portal' | 'settings';"
);

code = code.replace(
  "<TabsTrigger value=\"vendors\"><Truck className=\"h-3.5 w-3.5 mr-1\" />Vendors</TabsTrigger>",
  "<TabsTrigger value=\"vendors\"><Truck className=\"h-3.5 w-3.5 mr-1\" />Vendors</TabsTrigger>\n            <TabsTrigger value=\"budget\"><DollarSign className=\"h-3.5 w-3.5 mr-1\" />Budget</TabsTrigger>"
);

code = code.replace(
  "<TabsContent value=\"vendors\">\n            <EventVendorsTab eventId={eventId} organizationId={event.organization_id} />\n          </TabsContent>",
  "<TabsContent value=\"vendors\">\n            <EventVendorsTab eventId={eventId} organizationId={event.organization_id} />\n          </TabsContent>\n\n          <TabsContent value=\"budget\">\n            <EventBudgetTab eventId={eventId} organizationId={event.organization_id} />\n          </TabsContent>"
);

fs.writeFileSync(path, code);
