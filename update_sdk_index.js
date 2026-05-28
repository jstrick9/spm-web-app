const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sdk/index.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { timelineSdk } from './timeline.js';",
  "import { timelineSdk } from './timeline.js';\nimport { staffSdk } from './staff.js';"
);

code = code.replace(
  "timeline: timelineSdk,",
  "timeline: timelineSdk,\n  staff:    staffSdk,"
);

code = code.replace(
  "platformConfigSdk,",
  "platformConfigSdk, staffSdk,"
);

fs.writeFileSync(path, code);
