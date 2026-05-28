const fs = require('fs');

const guestsSdkPath = 'spm-web-app/wedding-app/client/src/sdk/guests.ts';
let sdkCode = fs.readFileSync(guestsSdkPath, 'utf8');

const bulkFn = `
  bulkCreate(eventId: string, mode: 'skip' | 'replace' | 'append', guests: GuestInput[]): Promise<{ inserted: number; updated: number; skipped: number }> {
    return api.post(\`/api/events/\${eventId}/guests/bulk\`, { mode, guests });
  },
`;

sdkCode = sdkCode.replace('update(guestId: string, patch: Partial<GuestInput>): Promise<{ guest: SdkGuest }> {', bulkFn + '\n  update(guestId: string, patch: Partial<GuestInput>): Promise<{ guest: SdkGuest }> {');

fs.writeFileSync(guestsSdkPath, sdkCode);
