const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// I made a malformed replace for the chair condition, there is a remnant ` />\n              )\n            }`

code = code.replace(/ \/>\n              \)\n            \}\n            return null;/g, '            return null;');

fs.writeFileSync(path, code);
