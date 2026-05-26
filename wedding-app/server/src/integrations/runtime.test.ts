import '../test/setup.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { db } from '../db/database.js';
import { integrationsRepo, orgsRepo, usersRepo } from '../db/repos/index.js';
import { hashPassword } from '../lib/crypto.js';
import { sealSecret } from '../lib/secrets.js';
import { _registerForTest, _unregisterForTest } from './registry.js';
import { runAction, verifyIntegration, requireConnected, IntegrationError } from './runtime.js';
import type { IntegrationProvider } from './types.js';

let orgId: string;

const TEST_PROVIDER_ID = 'test_provider';

function makeTestProvider(impl: {
  verify?: (ctx: never) => Promise<void>;
  actionRun?: (ctx: never, input: never) => Promise<unknown>;
}): IntegrationProvider {
  return {
    id: TEST_PROVIDER_ID,
    name: 'Test Provider',
    category: 'other',
    description: 'For tests only',
    iconKey: 'flask',
    kind: 'api_key',
    capabilities: ['send_email'],
    configSchema: z.object({ note: z.string().optional() }),
    secretSchema: z.object({ token: z.string() }),
    actions: [
      {
        id: 'echo',
        label: 'Echo',
        inputSchema: z.object({ msg: z.string() }),
        run: (impl.actionRun ?? (async (_ctx: unknown, input: { msg: string }) => ({ echoed: input.msg }))) as never,
      },
    ],
    verify: (impl.verify ?? (async () => {})) as never,
  };
}

beforeAll(() => {
  // Ensure NODE_ENV=test (setup.ts sets it via vitest config env)
  process.env.NODE_ENV = 'test';
});

beforeEach(() => {
  for (const t of [
    'integration_events', 'integrations',
    'organization_memberships', 'organizations', 'users',
  ]) db.prepare(`DELETE FROM ${t}`).run();
  _unregisterForTest(TEST_PROVIDER_ID);

  const pwd = hashPassword('pw123pw1');
  const user = usersRepo.create({
    email: `u${Math.random()}@x.com`, fullName: 'U',
    passwordHash: pwd.passwordHash, passwordSalt: pwd.passwordSalt,
  });
  orgId = orgsRepo.createWithOwner({
    name: 'O', slug: `o-${Math.random().toString(36).slice(2)}`, ownerId: user.id,
  });
});

function seedIntegration(secrets: object = { token: 'k' }) {
  return integrationsRepo.upsert({
    organizationId: orgId,
    provider: TEST_PROVIDER_ID,
    secretPayload: sealSecret(secrets),
    status: 'connected',
  });
}

describe('runtime.runAction', () => {
  it('decrypts secrets, validates input, runs the action, logs an event', async () => {
    _registerForTest(makeTestProvider({}));
    const row = seedIntegration({ token: 'xyz' });

    const result = await runAction<{ echoed: string }>({
      integrationId: row.id,
      actionId: 'echo',
      input: { msg: 'hello' },
    });
    expect(result.echoed).toBe('hello');

    const events = integrationsRepo.listEvents(row.id);
    expect(events).toHaveLength(1);
    expect((events[0] as { kind: string }).kind).toBe('test_provider.echo');
    expect((events[0] as { status: string }).status).toBe('ok');
  });

  it('rejects unknown action', async () => {
    _registerForTest(makeTestProvider({}));
    const row = seedIntegration();
    await expect(runAction({ integrationId: row.id, actionId: 'nope', input: {} }))
      .rejects.toThrow(/has no action/);
  });

  it('rejects invalid input (zod failure)', async () => {
    _registerForTest(makeTestProvider({}));
    const row = seedIntegration();
    await expect(runAction({ integrationId: row.id, actionId: 'echo', input: { wrong: 1 } }))
      .rejects.toThrow();
  });

  it('logs error event when the action throws', async () => {
    _registerForTest(makeTestProvider({
      actionRun: (async () => { throw new Error('downstream blew up'); }) as never,
    }));
    const row = seedIntegration();
    await expect(runAction({ integrationId: row.id, actionId: 'echo', input: { msg: 'x' } }))
      .rejects.toThrow(/downstream/);
    const events = integrationsRepo.listEvents(row.id);
    expect(events[0]).toMatchObject({ status: 'error' });
  });

  it('marks integration as error on auth-like failures', async () => {
    _registerForTest(makeTestProvider({
      actionRun: (async () => { throw new Error('401 Unauthorized'); }) as never,
    }));
    const row = seedIntegration();
    await expect(runAction({ integrationId: row.id, actionId: 'echo', input: { msg: 'x' } }))
      .rejects.toThrow();
    const after = integrationsRepo.findById(row.id)!;
    expect(after.status).toBe('error');
    expect(after.last_error).toMatch(/401/);
  });

  it('throws integration-not-found for unknown id', async () => {
    await expect(runAction({ integrationId: 'no-such', actionId: 'echo', input: {} }))
      .rejects.toThrow(IntegrationError);
  });

  it('throws when integration is disabled', async () => {
    _registerForTest(makeTestProvider({}));
    const row = seedIntegration();
    integrationsRepo.setStatus(row.id, 'disabled');
    await expect(runAction({ integrationId: row.id, actionId: 'echo', input: { msg: 'x' } }))
      .rejects.toThrow(/disabled/);
  });
});

describe('runtime.verifyIntegration', () => {
  it('on success: marks connected + logs ok', async () => {
    _registerForTest(makeTestProvider({}));
    const row = seedIntegration();
    integrationsRepo.setStatus(row.id, 'pending');
    await verifyIntegration(row.id);
    const after = integrationsRepo.findById(row.id)!;
    expect(after.status).toBe('connected');
    expect(after.last_synced_at).not.toBeNull();
  });

  it('on failure: marks error + propagates exception', async () => {
    _registerForTest(makeTestProvider({
      verify: (async () => { throw new Error('SMTP unreachable'); }) as never,
    }));
    const row = seedIntegration();
    await expect(verifyIntegration(row.id)).rejects.toThrow(/SMTP unreachable/);
    const after = integrationsRepo.findById(row.id)!;
    expect(after.status).toBe('error');
    expect(after.last_error).toMatch(/SMTP/);
  });
});

describe('runtime.requireConnected', () => {
  it('returns the row when connected', () => {
    _registerForTest(makeTestProvider({}));
    const row = seedIntegration();
    expect(requireConnected(orgId, TEST_PROVIDER_ID).id).toBe(row.id);
  });

  it('throws if not present', () => {
    expect(() => requireConnected(orgId, TEST_PROVIDER_ID)).toThrow(IntegrationError);
    // also matches the message
    expect(() => requireConnected(orgId, TEST_PROVIDER_ID)).toThrow(/No test_provider integration/);
  });

  it('throws if disabled', () => {
    _registerForTest(makeTestProvider({}));
    const row = seedIntegration();
    integrationsRepo.setStatus(row.id, 'disabled');
    expect(() => requireConnected(orgId, TEST_PROVIDER_ID)).toThrow(/is disabled/);
  });
});
