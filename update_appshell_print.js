const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/ui/AppShell.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  'className="flex-1 min-w-0"',
  'className="flex-1 min-w-0 print:m-0 print:p-0"'
);

// We need to ensure children prints fully
code = code.replace(
  'className={cn(\'mx-auto max-w-7xl px-4 sm:px-6 py-6\', className)}',
  'className={cn(\'mx-auto max-w-7xl px-4 sm:px-6 py-6 print:m-0 print:p-0 print:max-w-none\', className)}'
);

fs.writeFileSync(path, code);
