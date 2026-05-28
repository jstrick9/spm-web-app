const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { EventBudgetTab } from './budget/EventBudgetTab';\nimport { DollarSign, Printer } from 'lucide-react';",
  "import { EventBudgetTab } from './budget/EventBudgetTab';\nimport { EventContractsTab } from './contracts/EventContractsTab';\nimport { DollarSign, Printer, FileSignature } from 'lucide-react';"
);

code = code.replace(
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'budget' | 'staff' | 'layout' | 'chat' | 'portal' | 'settings';",
  "type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'budget' | 'contracts' | 'staff' | 'layout' | 'chat' | 'portal' | 'settings';"
);

code = code.replace(
  "<TabsTrigger value=\"budget\"><DollarSign className=\"h-3.5 w-3.5 mr-1\" />Budget</TabsTrigger>",
  "<TabsTrigger value=\"budget\"><DollarSign className=\"h-3.5 w-3.5 mr-1\" />Budget</TabsTrigger>\n            <TabsTrigger value=\"contracts\"><FileSignature className=\"h-3.5 w-3.5 mr-1\" />Contracts</TabsTrigger>"
);

code = code.replace(
  "</TabsContent>\n\n          <TabsContent value=\"staff\">",
  "</TabsContent>\n\n          <TabsContent value=\"contracts\">\n            <EventContractsTab eventId={eventId} />\n          </TabsContent>\n\n          <TabsContent value=\"staff\">"
);

fs.writeFileSync(path, code);
