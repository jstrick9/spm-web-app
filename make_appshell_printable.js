const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/ui/AppShell.tsx';
let code = fs.readFileSync(path, 'utf8');

// Hide top bar when printing
code = code.replace(
  '<header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">',
  '<header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 print:hidden">'
);

// Hide Sidebar when printing
code = code.replace(
  'className="hidden md:flex"',
  'className="hidden md:flex print:hidden"'
);

// Remove min-h-screen which breaks printing sometimes
code = code.replace(
  '<div className="min-h-screen bg-bg text-fg">',
  '<div className="min-h-screen bg-bg text-fg print:min-h-0 print:bg-white print:text-black">'
);

fs.writeFileSync(path, code);
