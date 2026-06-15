/**
 * SMS (Twilio) provider.
 *
 * Provides the platform's first concrete SMS sender using Twilio's REST API.
 * The worker dispatches jobs through action id `sendSms`, parallel to the
 * existing SMTP `sendEmail` path.
 */
import { z } from 'zod';
import type { IntegrationProvider, ProviderAction, IntegrationContext } from '../types.js';

const configSchema = z.object({
  accountSid: z.string().min(1, 'Twilio Account SID required'),
  fromNumber: z.string().min(3, 'Twilio sender/from number required'),
  messagingServiceSid: z.string().optional(),
});

const secretSchema = z.object({
  authToken: z.string().min(1, 'Twilio auth token required'),
});

const sendSmsInput = z.object({
  to: z.union([z.string().min(3), z.array(z.string().min(3)).min(1)]),
  body: z.string().min(1).max(1600),
});

type SendSmsInput = z.infer<typeof sendSmsInput>;

interface SendSmsResult {
  sent: Array<{ to: string; sid: string; status: string }>;
  failed: Array<{ to: string; error: string }>;
}

function authHeader(accountSid: string, authToken: string) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

async function sendOne(ctx: IntegrationContext, to: string, body: string) {
  const cfg = configSchema.parse(ctx.config);
  const secrets = secretSchema.parse(ctx.secrets);
  const params = new URLSearchParams();
  params.set('To', to);
  params.set('Body', body);
  if (cfg.messagingServiceSid) params.set('MessagingServiceSid', cfg.messagingServiceSid);
  else params.set('From', cfg.fromNumber);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: authHeader(cfg.accountSid, secrets.authToken),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const payload = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof payload.message === 'string' ? payload.message : `Twilio SMS failed with HTTP ${res.status}`;
    throw new Error(message);
  }
  return { sid: String(payload.sid || ''), status: String(payload.status || 'queued') };
}

const sendSms: ProviderAction<SendSmsInput, SendSmsResult> = {
  id: 'sendSms',
  label: 'Send SMS',
  inputSchema: sendSmsInput,
  async run(ctx, input) {
    const recipients = Array.isArray(input.to) ? input.to : [input.to];
    const sent: SendSmsResult['sent'] = [];
    const failed: SendSmsResult['failed'] = [];
    for (const to of recipients) {
      try {
        const result = await sendOne(ctx, to, input.body);
        sent.push({ to, ...result });
      } catch (err) {
        failed.push({ to, error: (err as Error).message });
      }
    }
    if (sent.length === 0 && failed.length > 0) {
      throw new Error(failed.map((f) => `${f.to}: ${f.error}`).join('; '));
    }
    return { sent, failed };
  },
};

export const smsTwilioProvider: IntegrationProvider = {
  id: 'sms_twilio',
  name: 'SMS (Twilio)',
  category: 'sms',
  description: 'Send SMS reminders and couple follow-ups through Twilio Programmable Messaging.',
  iconKey: 'message-square',
  docsUrl: 'https://www.twilio.com/docs/messaging/api/message-resource',
  kind: 'api_key',
  capabilities: ['send_sms'],
  configSchema,
  secretSchema,
  actions: [sendSms],
  async verify(ctx) {
    configSchema.parse(ctx.config);
    secretSchema.parse(ctx.secrets);
  },
};
