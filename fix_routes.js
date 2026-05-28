const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "function Routes({\n  user, memberships, orgId, onOrgConfigChanged,\n  user, orgId, onOrgConfigChanged,\n}: {\n  user: SdkUser;\n  orgId: string | null;\n  onOrgConfigChanged: (c: PartialPlatformConfig) => void;\n}) {",
  "function Routes({\n  user, memberships, orgId, onOrgConfigChanged,\n}: {\n  user: SdkUser;\n  memberships: SdkMembership[];\n  orgId: string | null;\n  onOrgConfigChanged: (c: PartialPlatformConfig) => void;\n}) {"
);

fs.writeFileSync(path, code);
