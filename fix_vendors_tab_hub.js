const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/vendors/EventVendorsTab.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { VendorTimelineChart } from './VendorTimelineChart';",
  "import { VendorTimelineChart } from './VendorTimelineChart';\nimport { VendorCommunicationsHub } from './hub/VendorCommunicationsHub';"
);

code = code.replace(
  "{vendors.length > 0 && <VendorTimelineChart eventId={eventId} />}",
  "{vendors.length > 0 && <VendorTimelineChart eventId={eventId} />}\n        {vendors.length > 0 && <VendorCommunicationsHub eventId={eventId} organizationId={organizationId} />}"
);

fs.writeFileSync(path, code);
