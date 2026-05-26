/**
 * Provider contract. Every integration implements this.
 *
 * Lifecycle:
 *   1. User clicks "Connect" → provider returns either an OAuth start URL
 *      (kind: 'oauth'), or a config form (kind: 'api_key' | 'smtp').
 *   2. After user input or OAuth callback, framework validates the config +
 *      secrets via the schemas, then stores them encrypted.
 *   3. Provider's `verify` runs to confirm the credentials work (e.g.
 *      send a test email, check OAuth token validity).
 *   4. Once `status='connected'`, app code calls provider actions via
 *      `runAction(integration, 'sendEmail', { to, subject, body })`.
 *   5. Inbound webhooks for the provider route to `webhookHandler`.
 *   6. Polling providers have `poll` called by the job queue worker on
 *      a configurable schedule.
 */
import type { z } from 'zod';

export type IntegrationKind = 'oauth' | 'api_key' | 'smtp' | 'webhook_only';

export interface IntegrationContext {
  /** The decrypted secret payload for this integration. */
  secrets: Record<string, unknown>;
  /** The (public) config. */
  config: Record<string, unknown>;
  /** The integration's stable id. */
  integrationId: string;
  /** Org that owns it. */
  organizationId: string;
}

export interface ProviderAction<TInput = unknown, TOutput = unknown> {
  /** Stable id, used by callers: e.g. 'sendEmail'. */
  id: string;
  /** Human label for UI. */
  label: string;
  /** zod schema for the input. */
  inputSchema: z.ZodType<TInput>;
  /** Executes the action against the live provider. */
  run: (ctx: IntegrationContext, input: TInput) => Promise<TOutput>;
}

export interface IntegrationProvider {
  id: string;                            // 'email_smtp' | 'calendly' | ...
  name: string;                          // 'Email (SMTP)'
  category: 'email' | 'calendar' | 'payments' | 'esign' | 'sms' | 'storage' | 'webhook' | 'other';
  description: string;
  iconKey: string;                       // for the UI to pick an icon
  docsUrl?: string;
  kind: IntegrationKind;

  /** Capabilities this provider supports. Used to advertise to admins. */
  capabilities: ReadonlyArray<
    'send_email' | 'send_sms' | 'fetch_calendar' | 'push_calendar'
    | 'collect_payment' | 'send_esign_envelope' | 'store_file' | 'receive_webhook'
  >;

  /** Schema for the non-secret config (e.g. SMTP host, sender email). */
  configSchema: z.ZodType<Record<string, unknown>>;
  /** Schema for the secret payload (e.g. SMTP password, OAuth token). */
  secretSchema: z.ZodType<Record<string, unknown>>;

  /**
   * For OAuth providers: build the authorization URL. The framework adds
   * `state` + `redirect_uri`.
   */
  buildAuthUrl?: (params: {
    state: string;
    redirectUri: string;
    pkceChallenge?: string;
  }) => string;

  /**
   * Exchange an authorization code for tokens. Called by the OAuth callback.
   * Should return secrets (will be sealed and stored).
   */
  exchangeCode?: (params: {
    code: string;
    redirectUri: string;
    pkceVerifier?: string;
  }) => Promise<{ secrets: Record<string, unknown>; config?: Record<string, unknown> }>;

  /**
   * Refresh OAuth tokens. Called automatically when an access token expires.
   */
  refreshTokens?: (ctx: IntegrationContext) => Promise<Record<string, unknown>>;

  /**
   * Verify the credentials are good. Called right after connection +
   * whenever the integration's "Test connection" button is clicked.
   * Should throw on failure with a user-readable message.
   */
  verify: (ctx: IntegrationContext) => Promise<void>;

  /**
   * Verbs the framework can dispatch. Looked up by id at call time.
   */
  actions: ReadonlyArray<ProviderAction<any, any>>;  // input typed via zod; runtime-safe

  /**
   * Inbound webhook handler. Receives the raw body + headers; must
   * verify the signature (if applicable) and dispatch to app code.
   * Returns the HTTP status the framework should send back.
   */
  webhookHandler?: (params: {
    ctx: IntegrationContext;
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
  }) => Promise<{ statusCode: number; body?: unknown }>;

  /**
   * For providers that don't push webhooks: how often to poll, and what
   * to do when we do. Worker calls this on the configured interval.
   */
  poll?: {
    intervalSec: number;
    run: (ctx: IntegrationContext) => Promise<void>;
  };
}
