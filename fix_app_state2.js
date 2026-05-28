const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "function AuthenticatedApp({ user, memberships, onLogout }: { user: SdkUser;\n  memberships: SdkMembership[]; memberships: SdkMembership[]; onLogout: () => void }) {",
  "function AuthenticatedApp({ user, memberships, onLogout }: { user: SdkUser; memberships: SdkMembership[]; onLogout: () => void }) {"
);

fs.writeFileSync(path, code);
