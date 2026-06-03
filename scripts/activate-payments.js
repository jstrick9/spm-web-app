/**
 * activate-payments.js — Secure Payment Link Activation CLI tool.
 *
 * This script allows administrators to securely input and activate live Square
 * and Stripe credentials into the SQLite database. Credentials are encrypted
 * with AES-256-GCM using the $WEDDING_SECRETS_KEY before being stored in the
 * `integrations` table.
 *
 * Usage:
 *   export WEDDING_SECRETS_KEY=...
 *   export STRIPE_SECRET_KEY=sk_live_...
 *   export STRIPE_SIGNING_SECRET=whsec_...
 *   export SQUARE_ACCESS_TOKEN=EAAA...
 *   export SQUARE_LOCATION_ID=L...
 *   node scripts/activate-payments.js
 */
import Database from 'better-sqlite3';
import { createCipheriv, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PKG_ROOT = resolve(__dirname, '..', 'server');

// ── AES-256-GCM Encryption logic matching secrets.ts ────────────────────────

const ALG = 'aes-256-gcm';
const VERSION = 1;
const KEY_LEN = 32;
const IV_LEN = 12;

function parseKey(raw) {
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === 64) {
    return Buffer.from(raw, 'hex');
  }
  if (/^[A-Za-z0-9+/=_-]+$/.test(raw)) {
    const buf = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (buf.length === KEY_LEN) return buf;
  }
  throw new Error(
    'WEDDING_SECRETS_KEY must be 32 bytes (64 hex chars or 44 base64 chars). ' +
    'Generate one with: openssl rand -hex 32'
  );
}

function sealSecret(value, masterKeyRaw) {
  const key = parseKey(masterKeyRaw);
  const iv = randomBytes(IV_LEN);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, enc]).toString('base64');
}

// ── Main logic ─────────────────────────────────────────────────────────────

async function main() {
  console.log('--- SECURE PAYMENT ACTIVATION ---');

  const masterKey = process.env.WEDDING_SECRETS_KEY;
  if (!masterKey) {
    console.error('ERROR: WEDDING_SECRETS_KEY environment variable is not set.');
    console.log('Please set it using: export WEDDING_SECRETS_KEY=$(openssl rand -hex 32)');
    process.exit(1);
  }

  const dbPath = process.env.WEDDING_DB_PATH || resolve(SERVER_PKG_ROOT, 'data', 'wedding.db');
  if (!existsSync(dbPath)) {
    console.error(`ERROR: Database not found at ${dbPath}`);
    process.exit(1);
  }

  console.log(`Connecting to database: ${dbPath}`);
  const db = new Database(dbPath);

  // Retrieve the first organization ID to associate the integrations with
  const org = db.prepare('SELECT id, name FROM organizations LIMIT 1').get();
  if (!org) {
    console.error('ERROR: No organization found in the database. Please register/seed first.');
    process.exit(1);
  }
  console.log(`Targeting Organization: ${org.name} (${org.id})`);

  // 1. Process Stripe
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripeSigning = process.env.STRIPE_SIGNING_SECRET;
  if (stripeKey) {
    console.log('\nConfiguring Stripe...');
    const secrets = {
      secretKey: stripeKey,
      webhookSigningSecret: stripeSigning || undefined,
    };
    const sealed = sealSecret(secrets, masterKey);
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO integrations (id, organization_id, provider, status, display_name, config, secret_payload)
      VALUES (?, ?, 'stripe', 'connected', 'Stripe Live', '{"currency":"usd"}', ?)
      ON CONFLICT(organization_id, provider) DO UPDATE SET
        secret_payload = excluded.secret_payload,
        status = 'connected',
        updated_at = datetime('now')
    `).run(id, org.id, sealed);
    console.log('✅ Stripe integration activated successfully!');
  } else {
    console.log('\n[Skipped Stripe] STRIPE_SECRET_KEY not set.');
  }

  // 2. Process Square
  const squareToken = process.env.SQUARE_ACCESS_TOKEN;
  const squareLocation = process.env.SQUARE_LOCATION_ID;
  const squareWebhook = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (squareToken && squareLocation) {
    console.log('\nConfiguring Square...');
    const secrets = {
      accessToken: squareToken,
      webhookSignatureKey: squareWebhook || undefined,
    };
    const sealed = sealSecret(secrets, masterKey);
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO integrations (id, organization_id, provider, status, display_name, config, secret_payload)
      VALUES (?, ?, 'square', 'connected', 'Square Live', ?, ?)
      ON CONFLICT(organization_id, provider) DO UPDATE SET
        secret_payload = excluded.secret_payload,
        config = excluded.config,
        status = 'connected',
        updated_at = datetime('now')
    `).run(id, org.id, JSON.stringify({ environment: 'production', locationId: squareLocation, currency: 'USD' }), sealed);
    console.log('✅ Square integration activated successfully!');
  } else {
    console.log('\n[Skipped Square] SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID not set.');
  }

  db.close();
  console.log('\n--- ACTIVATION COMPLETE ---');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
