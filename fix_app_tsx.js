const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /    try \{\n      await sdk\.portal\.submitRsvp\(eventId[\s\S]*?<\/Card>\n    <\/div>\n  \);\n}/m;
code = code.replace(regex, '');

fs.writeFileSync(path, code);
