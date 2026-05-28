const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/VendorPortal.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "                  />\n               <div className=\"lg:col-span-2 space-y-6\">",
  "                  />"
);

fs.writeFileSync(path, code);
