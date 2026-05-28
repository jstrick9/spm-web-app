const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import type { SdkUser } from './sdk/types';",
  "import type { SdkUser, SdkMembership } from './sdk/types';"
);

code = code.replace(
  "const [user, setUser] = useState<SdkUser | null>(null);",
  "const [user, setUser] = useState<SdkUser | null>(null);\n  const [memberships, setMemberships] = useState<SdkMembership[]>([]);"
);

code = code.replace(
  "setUser(me.user);",
  "setUser(me.user);\n        setMemberships(me.memberships);"
);

code = code.replace(
  "if (!user) return <AuthScreen onAuth={setUser} />;",
  "if (!user) return <AuthScreen onAuth={(u, m) => { setUser(u); setMemberships(m || []); }} />;"
);

code = code.replace(
  "return <AuthenticatedApp user={user} onLogout={() => {",
  "return <AuthenticatedApp user={user} memberships={memberships} onLogout={() => {"
);

code = code.replace(
  "function AuthenticatedApp({ user, onLogout }: { user: SdkUser; onLogout: () => void }) {",
  "function AuthenticatedApp({ user, memberships, onLogout }: { user: SdkUser; memberships: SdkMembership[]; onLogout: () => void }) {"
);

code = code.replace(
  "function AuthScreen({ onAuth }: { onAuth: (u: SdkUser) => void }) {",
  "function AuthScreen({ onAuth }: { onAuth: (u: SdkUser, m?: SdkMembership[]) => void }) {"
);

code = code.replace(
  "onAuth(res.user);",
  "// In auth screen, we need to fetch memberships after login\n      const me = await sdk.auth.me();\n      onAuth(me.user, me.memberships);"
);

code = code.replace(
  "<Routes user={user} orgId={orgId} onOrgConfigChanged={setOrgConfig} />",
  "<Routes user={user} memberships={memberships} orgId={orgId} onOrgConfigChanged={setOrgConfig} />"
);

code = code.replace(
  "function Routes({",
  "function Routes({\n  user, memberships, orgId, onOrgConfigChanged,"
);

code = code.replace(
  "user: SdkUser;",
  "user: SdkUser;\n  memberships: SdkMembership[];"
);

fs.writeFileSync(path, code);
