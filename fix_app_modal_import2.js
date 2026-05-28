const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = "import { WelcomeModal } from './components/onboarding/WelcomeModal';\n" + code;

fs.writeFileSync(path, code);
