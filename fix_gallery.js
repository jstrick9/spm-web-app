const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/gallery/EventGalleryTab.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "id: \\`img-\\${Date.now()}-\\${Math.random()}\\`,",
  "id: `img-${Date.now()}-${Math.random()}`,"
);

fs.writeFileSync(path, code);
