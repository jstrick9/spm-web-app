const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sdk/types.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "visibility: 'private' | 'event' | 'venue' | 'public';",
  "visibility: 'private' | 'event' | 'venue' | 'public';\n  approval_status?: 'draft' | 'pending' | 'approved' | 'rejected';"
);

fs.writeFileSync(path, code);
