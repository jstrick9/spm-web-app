const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/src/sdk/guests.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import type { SdkGuest, SdkGuestCounts, SdkRsvp, SdkPortalInfo } from './types.js';",
  "import type { SdkGuest, SdkGuestCounts, SdkRsvp, SdkPortalInfo, SdkPortalConfig } from './types.js';"
);

const newMethods = `
  getPortalConfig(eventId: string): Promise<{ config: SdkPortalConfig | undefined }> {
    return api.get(\`/api/events/\${eventId}/portal-config\`);
  },
  
  updatePortalConfig(eventId: string, payload: {
    enabled: boolean;
    password?: string;
    clearPassword?: boolean;
    accessStartsAt?: string;
    accessEndsAt?: string;
    gracePeriodHours?: number;
    config?: Record<string, unknown>;
  }): Promise<{ config: SdkPortalConfig }> {
    return api.put(\`/api/events/\${eventId}/portal-config\`, payload);
  },
`;

code = code.replace(
  "revokePortalToken(guestId: string): Promise<void> {\n    return api.delete(`/api/guests/${guestId}/portal-token`);\n  },",
  "revokePortalToken(guestId: string): Promise<void> {\n    return api.delete(`/api/guests/${guestId}/portal-token`);\n  },\n" + newMethods
);

fs.writeFileSync(path, code);
