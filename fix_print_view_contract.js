const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/screens/events/contracts/ContractPrintView.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'className="hidden print:block p-12 bg-white text-black min-h-screen"',
  'className="hidden print:block bg-white text-black w-full"'
);

fs.writeFileSync(path, code);
