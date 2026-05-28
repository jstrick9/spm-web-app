const fs = require('fs');

const path = 'spm-web-app/wedding-app/server/src/routes/vendors.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "let timeline = [];",
  "let timeline: any[] = [];"
);

fs.writeFileSync(path, code);
