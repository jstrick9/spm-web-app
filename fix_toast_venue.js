const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/catalog/venue/VenueBuilder.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "toast({ title: 'No valid paths found in SVG', variant: 'warning' });",
  "toast({ title: 'No valid paths found in SVG', variant: 'destructive' });"
);

fs.writeFileSync(path, code);
