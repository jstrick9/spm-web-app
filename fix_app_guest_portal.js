const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { VendorPortal } from './screens/VendorPortal';",
  "import { VendorPortal } from './screens/VendorPortal';\nimport { PublicGuestPortal } from './screens/portal/PublicGuestPortal';"
);

code = code.replace(
  "if (portal) return <GuestPortal eventId={portal.eventId} />;",
  "if (portal) return <PublicGuestPortal eventId={portal.eventId} />;"
);

fs.writeFileSync(path, code);
