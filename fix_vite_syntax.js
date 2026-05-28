const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/vite.config.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("    })],,", "    })],");

fs.writeFileSync(path, code);
