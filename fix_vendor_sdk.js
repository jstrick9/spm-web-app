const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sdk/vendors.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "export const vendorsSdk = {",
  "export const vendorsSdk = {\n  portalInfo(vendorId: string) {\n    return api.get(`/api/portal/vendors/${vendorId}/info`, { auth: false });\n  },"
);

fs.writeFileSync(path, code);
