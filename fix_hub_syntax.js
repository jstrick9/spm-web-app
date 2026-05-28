const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/vendors/hub/VendorCommunicationsHub.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /id: \\`m1-\\\$\{activeVendorId\}\\`/g,
  "id: `m1-${activeVendorId}`"
);

code = code.replace(
  /id: \\`m2-\\\$\{activeVendorId\}\\`/g,
  "id: `m2-${activeVendorId}`"
);

code = code.replace(
  /toast\(\{ title: 'Broadcast Sent', description: \\`Message delivered to \\\$\{vendors\.length\} vendors\.\\`, variant: 'success' \}\);/,
  "toast({ title: 'Broadcast Sent', description: `Message delivered to ${vendors.length} vendors.`, variant: 'success' });"
);

code = code.replace(
  /id: \\`m-\\\$\{Date\.now\(\)\}\\`,/,
  "id: `m-${Date.now()}`,"
);

fs.writeFileSync(path, code);
