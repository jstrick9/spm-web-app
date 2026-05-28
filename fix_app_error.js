const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import { WelcomeModal } from './components/onboarding/WelcomeModal';",
  "import { WelcomeModal } from './components/onboarding/WelcomeModal';\nimport { ErrorBoundary } from './ui/ErrorBoundary';"
);

code = code.replace(
  "// Authenticated app\n  return <PlatformApp />;",
  "// Authenticated app\n  return <ErrorBoundary><PlatformApp /></ErrorBoundary>;"
);

fs.writeFileSync(path, code);
