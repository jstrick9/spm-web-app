const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { WelcomeModal } from './components/onboarding/WelcomeModal';",
  "import { WelcomeModal } from './components/onboarding/WelcomeModal';"
);

// Ah, wait - the regex replace in the previous script actually didn't work because `import { NotificationCenter }` wasn't matched properly or the replace was faulty.

const replacement = `
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { WelcomeModal } from './components/onboarding/WelcomeModal';
`;
code = code.replace(
  "import { NotificationCenter } from '../components/notifications/NotificationCenter';",
  replacement
);

fs.writeFileSync(path, code);

const path2 = 'spm-web-app/wedding-app/client/src/screens/portal/PublicGuestPortal.tsx';
let code2 = fs.readFileSync(path2, 'utf8');
code2 = code2.replace(
  "<Badge variant=\"secondary\" className=\"ml-2 bg-[#e1d5c9]/30\">{opt.votes} votes</Badge>",
  "<Badge variant=\"outline\" className=\"ml-2 bg-[#e1d5c9]/30 border-[#e1d5c9] text-[#2c3e2e]\">{opt.votes} votes</Badge>"
);

fs.writeFileSync(path2, code2);
