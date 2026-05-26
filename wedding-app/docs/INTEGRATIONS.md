# Integration Framework

Self-hosted, pluggable connectors to external services — Calendly, Outlook,
Square, DocuSign, Twilio, etc. Designed so adding a new provider takes about
a day; security, retry, audit, and admin UI are handled by the framework.

## Status — what's built

| Concern | Status |
|---|---|
| Encrypted credentials in SQLite (AES-256-GCM) | ✅ `src/lib/secrets.ts` |
| Integration registry + provider contract | ✅ `src/integrations/registry.ts`, `types.ts` |
| Runtime: typed action dispatch + audit + auto-error-status | ✅ `src/integrations/runtime.ts` |
| Database tables (integrations, integration_events, oauth_states, job_queue) | ✅ migration `0002_integrations.sql` |
| Persistent job queue + in-process worker | ✅ `src/db/repos/jobs.ts`, `src/jobs/worker.ts` |
| Admin REST endpoints (CRUD + test-connection + audit log) | ✅ `src/routes/integrations.ts` |
| **First provider: Email (SMTP)** | ✅ `src/integrations/providers/email_smtp.ts` |
| Admin UI to set up + manage integrations | ⏳ Week 1 Day 2 (next) |
| OAuth start/callback infrastructure | ⏳ Week 2 (when Calendly lands) |
| Inbound webhook receiver | ⏳ Week 2 |
| Outbound webhook (Zapier-style) | ⏳ Week 10 |
| Calendly / Google Cal / Outlook / Square / DocuSign / Twilio / Dropbox | ⏳ woven into Weeks 2, 4, 5, 6, 8, 9 |

## Architecture (TL;DR)

```
┌──────────────────────────────────────────────────────────────────┐
│  App code (e.g. RSVP confirmation flow)                          │
│                                                                  │
│    await jobsRepo.enqueue({                                      │
│      kind: 'email.send',                                         │
│      payload: { integrationId, to, subject, html },              │
│    });                                                           │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼  (worker tick polls job_queue every 1s)
┌──────────────────────────────────────────────────────────────────┐
│  src/jobs/worker.ts  →  handler 'email.send'                     │
│                       →  runAction({ actionId: 'sendEmail' })    │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  src/integrations/runtime.ts                                     │
│    1. Load integration row                                       │
│    2. openSecret() → decrypt SMTP credentials via AES-GCM        │
│    3. zod-validate input                                         │
│    4. Dispatch to provider.actions[id].run(ctx, input)           │
│    5. Log integration_event (success or error)                   │
│    6. Auto-mark integration as 'error' on auth-style failures    │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  src/integrations/providers/email_smtp.ts                        │
│    nodemailer.createTransport(...).sendMail(...)                 │
└──────────────────────────────────────────────────────────────────┘
```

## Secrets storage

All integration credentials are stored encrypted in `integrations.secret_payload`:

- **Cipher**: AES-256-GCM (authenticated encryption)
- **Key**: 32 bytes from `WEDDING_SECRETS_KEY` env var
- **Wire**: `base64(version | iv(12) | tag(16) | ciphertext)`
- **Decryption**: only in `src/integrations/runtime.ts` — never returned via REST

The encrypt/decrypt module (`src/lib/secrets.ts`) has 8 tests covering tampering, key rotation, key-loss errors, and both hex/base64 key formats.

## How to add a new provider

```ts
// src/integrations/providers/calendly.ts
import { z } from 'zod';
import type { IntegrationProvider } from '../types.js';

const configSchema = z.object({
  organizationUri: z.string().url(),  // Calendly org URI
});

const secretSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
});

export const calendlyProvider: IntegrationProvider = {
  id: 'calendly',
  name: 'Calendly',
  category: 'calendar',
  description: 'Pull venue tour bookings into the Events kanban.',
  iconKey: 'calendar',
  kind: 'oauth',
  capabilities: ['fetch_calendar'],
  configSchema,
  secretSchema,
  buildAuthUrl: ({ state, redirectUri }) =>
    `https://auth.calendly.com/oauth/authorize?client_id=...&state=${state}&redirect_uri=${redirectUri}`,
  exchangeCode: async ({ code, redirectUri }) => {
    // POST to Calendly's token endpoint; return { secrets, config }
    return { secrets: { accessToken: '...', refreshToken: '...', expiresAt: Date.now() + 3600_000 } };
  },
  async verify(ctx) {
    // Call /users/me — throw on 401
  },
  actions: [],
  poll: {
    intervalSec: 300,  // every 5 min
    async run(ctx) {
      // Fetch new bookings, create Event rows in 'lead' status
    },
  },
};
```

Then add it to `PROVIDERS` in `src/integrations/registry.ts` — the admin UI, REST endpoints, audit log, and worker all auto-pick it up.

## Permissions

| Action | Required permission |
|---|---|
| View integrations list | `org.view` |
| View provider catalog | `org.settings.manage` |
| Create / update / delete integration | `org.settings.manage` |
| Test connection | `org.settings.manage` |
| View integration audit log | `audit.view` |

By default, **owner** and **admin** roles can configure integrations. Custom roles can grant `org.settings.manage` to other people (e.g. a "Tech Lead" role).

## What never leaves the server

- `integrations.secret_payload` — encrypted; only ever decrypted at action-run time
- `integrations.webhook_secret` — for verifying inbound webhook signatures
- `oauth_states.pkce_verifier` — short-lived OAuth state

REST responses use `publicView()` which strips both `secret_payload` and `webhook_secret`. The only signal of whether secrets exist is `hasSecrets: boolean`.

## Job queue

`job_queue` is a single-table durable queue, polled every 1 second by the
in-process worker. No Redis or external broker. Failed jobs retry with
exponential backoff (60s × 2^attempts, capped at 1 hour) up to `max_attempts`
(default 5), then move to `dead`. Stuck "running" jobs whose worker died
(no heartbeat for > 5 min) are reclaimed automatically.
