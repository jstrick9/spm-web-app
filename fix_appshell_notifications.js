const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/ui/AppShell.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { ThemeToggle } from './ThemeToggle';",
  "import { ThemeToggle } from './ThemeToggle';\nimport { NotificationCenter } from '../components/notifications/NotificationCenter';"
);

code = code.replace(
  "<ThemeToggle />\n\n          {/* User menu — simple version (no dropdown yet) */}",
  "<ThemeToggle />\n          <NotificationCenter />\n\n          {/* User menu — simple version (no dropdown yet) */}"
);

fs.writeFileSync(path, code);
