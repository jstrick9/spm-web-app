const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { guestsSdk } from '../../../sdk/guests';",
  "import { guestsSdk } from '../../../sdk/guests';\nimport { sdk } from '../../../sdk';"
);

fs.writeFileSync(path, code);
