const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { EventInvitesTab } from './invites/EventInvitesTab';",
  "import { EventInvitesTab } from './invites/EventInvitesTab';\nimport { EventFeedbackTab } from './feedback/EventFeedbackTab';\nimport { BarChart } from 'lucide-react';"
);

code = code.replace(
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'budget' | 'contracts' | 'gallery' | 'staff' | 'layout' | 'invites' | 'chat' | 'portal' | 'settings';",
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'budget' | 'contracts' | 'gallery' | 'staff' | 'layout' | 'invites' | 'feedback' | 'chat' | 'portal' | 'settings';"
);

code = code.replace(
  "<TabsTrigger value=\"invites\"><Mail className=\"h-3.5 w-3.5 mr-1\" />Invites</TabsTrigger>",
  "<TabsTrigger value=\"invites\"><Mail className=\"h-3.5 w-3.5 mr-1\" />Invites</TabsTrigger>\n            <TabsTrigger value=\"feedback\"><BarChart className=\"h-3.5 w-3.5 mr-1\" />Polls & Feedback</TabsTrigger>"
);

code = code.replace(
  "<TabsContent value=\"invites\">\n            <EventInvitesTab eventId={eventId} />\n          </TabsContent>",
  "<TabsContent value=\"invites\">\n            <EventInvitesTab eventId={eventId} />\n          </TabsContent>\n\n          <TabsContent value=\"feedback\">\n            <EventFeedbackTab eventId={eventId} />\n          </TabsContent>"
);

fs.writeFileSync(path, code);
