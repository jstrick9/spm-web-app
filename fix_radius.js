const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/offsetX={item.radius}/g, "offsetX={item.radius||0}");
code = code.replace(/width={item.radius \* 2}/g, "width={(item.radius||0) * 2}");

fs.writeFileSync(path, code);
