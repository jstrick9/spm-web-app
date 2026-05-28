const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sdk/vendors.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "portalInfo(vendorId: string) {\n    return api.get(`/api/portal/vendors/${vendorId}/info`, { auth: false });\n  },",
  "portalInfo(vendorId: string) {\n    return api.get(`/api/portal/vendors/${vendorId}/info`, { auth: false });\n  },\n  submitQuestionnaire(vendorId: string, payload: Record<string, any>) {\n    return api.post(`/api/portal/vendors/${vendorId}/questionnaire`, payload, { auth: false });\n  },"
);

fs.writeFileSync(path, code);
