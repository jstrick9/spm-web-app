const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sdk/types.ts';
let code = fs.readFileSync(path, 'utf8');

// Add metadata to SdkTimelineItem
code = code.replace(
  "duration_min: number | null;\n}",
  "duration_min: number | null;\n  metadata?: string;\n}"
);

fs.writeFileSync(path, code);
