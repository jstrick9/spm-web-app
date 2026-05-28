const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { EventContractsTab } from './contracts/EventContractsTab';\nimport { DollarSign, Printer, FileSignature } from 'lucide-react';",
  "import { EventContractsTab } from './contracts/EventContractsTab';\nimport { EventGalleryTab } from './gallery/EventGalleryTab';\nimport { DollarSign, Printer, FileSignature, ImageIcon } from 'lucide-react';"
);

code = code.replace(
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'budget' | 'contracts' | 'staff' | 'layout' | 'chat' | 'portal' | 'settings';",
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'budget' | 'contracts' | 'gallery' | 'staff' | 'layout' | 'chat' | 'portal' | 'settings';"
);

code = code.replace(
  "<TabsTrigger value=\"contracts\"><FileSignature className=\"h-3.5 w-3.5 mr-1\" />Contracts</TabsTrigger>\n            <TabsTrigger value=\"staff\">",
  "<TabsTrigger value=\"contracts\"><FileSignature className=\"h-3.5 w-3.5 mr-1\" />Contracts</TabsTrigger>\n            <TabsTrigger value=\"gallery\"><ImageIcon className=\"h-3.5 w-3.5 mr-1\" />Gallery</TabsTrigger>\n            <TabsTrigger value=\"staff\">"
);

code = code.replace(
  "<TabsContent value=\"contracts\">\n            <EventContractsTab eventId={eventId} />\n          </TabsContent>",
  "<TabsContent value=\"contracts\">\n            <EventContractsTab eventId={eventId} />\n          </TabsContent>\n\n          <TabsContent value=\"gallery\">\n            <EventGalleryTab eventId={eventId} />\n          </TabsContent>"
);

fs.writeFileSync(path, code);
