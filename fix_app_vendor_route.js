const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { EventDetail } from './screens/events/EventDetail';",
  "import { EventDetail } from './screens/events/EventDetail';\nimport { VendorPortal } from './screens/VendorPortal';"
);

code = code.replace(
  "const portal = matchPath('/portal/:eventId', path);\n  if (portal) return <GuestPortal eventId={portal.eventId} />;",
  "const portal = matchPath('/portal/:eventId', path);\n  if (portal) return <GuestPortal eventId={portal.eventId} />;\n  const vendorPortal = matchPath('/vendor/:vendorId', path);\n  if (vendorPortal) return <VendorPortal vendorId={vendorPortal.vendorId} />;"
);

fs.writeFileSync(path, code);
