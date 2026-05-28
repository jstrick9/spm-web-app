const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/EventDetail.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  '<Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>',
  '<Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="print:hidden">'
);

fs.writeFileSync(path, code);
