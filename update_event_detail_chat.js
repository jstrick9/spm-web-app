const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { EventStaffTab } from './staff/EventStaffTab';",
  "import { EventStaffTab } from './staff/EventStaffTab';\nimport { ChatSystem } from './chat/ChatSystem';"
);

code = code.replace(
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'staff' | 'layout' | 'portal' | 'settings';",
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'staff' | 'layout' | 'chat' | 'portal' | 'settings';"
);

code = code.replace(
  "<TabsTrigger value=\"staff\"><ClipboardCheck className=\"h-3.5 w-3.5 mr-1\" />Staff</TabsTrigger>",
  "<TabsTrigger value=\"staff\"><ClipboardCheck className=\"h-3.5 w-3.5 mr-1\" />Staff</TabsTrigger>\n            <TabsTrigger value=\"chat\"><MessageCircle className=\"h-3.5 w-3.5 mr-1\" />Chat</TabsTrigger>"
);

// We need the user context
code = code.replace(
  "export function EventDetail({ eventId }: Props) {",
  "export function EventDetail({ eventId, user }: Props & { user: any }) {"
);

code = code.replace(
  "<TabsContent value=\"layout\">\n            <CanvasPage event={event} />\n          </TabsContent>",
  "<TabsContent value=\"layout\">\n            <CanvasPage event={event} />\n          </TabsContent>\n\n          <TabsContent value=\"chat\">\n            <ChatSystem eventId={eventId} currentUser={user} />\n          </TabsContent>"
);

fs.writeFileSync(path, code);
