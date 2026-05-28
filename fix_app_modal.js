const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { NotificationCenter } from '../components/notifications/NotificationCenter';",
  "import { NotificationCenter } from '../components/notifications/NotificationCenter';\nimport { WelcomeModal } from './components/onboarding/WelcomeModal';"
);

code = code.replace(
  "<CommandPalette\n        open={paletteOpen}\n        onOpenChange={setPaletteOpen}\n        items={commandItems}\n      />",
  "<CommandPalette\n        open={paletteOpen}\n        onOpenChange={setPaletteOpen}\n        items={commandItems}\n      />\n      <WelcomeModal memberships={memberships} onComplete={() => {}} />"
);

fs.writeFileSync(path, code);
