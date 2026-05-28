const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/sdk/types.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "guests: Array<{ id: string; fullName: string }>;",
  "guests: Array<{ id: string; fullName: string; tableAssignment?: string | null; seatAssignment?: string | null }>;\n  layout?: Record<string, any> | null;"
);

fs.writeFileSync(path, code);
