const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /<Stage [\s\S]*?<Stage /;
code = code.replace(regex, '<Stage ');

fs.writeFileSync(path, code);
