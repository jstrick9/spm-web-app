const fs = require('fs');

const path2 = 'spm-web-app/wedding-app/client/src/screens/events/vendors/EventVendorsTab.tsx';
let code2 = fs.readFileSync(path2, 'utf8');

code2 = code2.replace(
  "</Card>\n          {vendors.length > 0 && <VendorTimelineChart eventId={eventId} />}\n        </>\n      )}",
  "</Card>\n      )}\n\n      {vendors.length > 0 && <VendorTimelineChart eventId={eventId} />}"
);

fs.writeFileSync(path2, code2);
