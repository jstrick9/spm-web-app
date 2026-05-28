const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/layouts/CanvasPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "const [tables, chairs, dances, stages] = await Promise.all([",
  "const [tables, fixtures] = await Promise.all(["
);

code = code.replace(
  "return [...tables.items, ...chairs.items];",
  "return [...tables.items, ...fixtures.items];"
);

fs.writeFileSync(path, code);
