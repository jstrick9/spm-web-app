const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { ConfigProvider } from './config/ConfigProvider';",
  "import { ConfigProvider } from './config/ConfigProvider';\nimport { ReloadPrompt } from './ReloadPrompt';"
);

code = code.replace(
  "<CommandPalette\n        open={paletteOpen}",
  "<ReloadPrompt />\n      <CommandPalette\n        open={paletteOpen}"
);

fs.writeFileSync(path, code);
