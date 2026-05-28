const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sdk/types.ts';
let code = fs.readFileSync(path, 'utf8');

// I will just add the explicit property `metadata: string;` 
code = code.replace(
  "vendor_id: string | null;",
  "vendor_id: string | null;\n  metadata?: string;"
);

fs.writeFileSync(path, code);
