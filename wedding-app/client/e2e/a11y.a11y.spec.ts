import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, existsSync } from 'node:fs';

/**
 * Accessibility (axe-core) smoke suite for the public, no-auth surfaces.
 *
 * Scans against WCAG 2.0/2.1 A & AA rule tags and fails the build on any
 * violation. These two screens are the highest-traffic, lowest-setup surfaces:
 *   1. Login screen        (every venue user hits this)
 *   2. Public guest portal (every wedding guest hits this)
 *
 * The portal needs a real event id; scripts/a11y-test.sh seeds the DB and
 * writes the id to .a11y-event-id so this spec can read it. If the file is
 * absent (e.g. `npx playwright test` run directly), the spec self-resolves an
 * id through the demo owner's API — mirroring exactly what the harness
 * script does — so the portal scan never silently skips against a running
 * server. It only skips when the server is unreachable or unseeded.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type AxeViolation = {
  id: string;
  impact?: string;
  help: string;
  helpUrl: string;
  nodes: Array<{ target: string[] }>;
};

function seededEventId(): string | null {
  for (const p of ['../.a11y-event-id', '.a11y-event-id', '../../.a11y-event-id']) {
    if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  }
  return process.env.A11Y_EVENT_ID ?? null;
}

/**
 * Self-service fallback: resolve a seeded event id through the API exactly
 * like scripts/a11y-test.sh does (demo owner login -> first org -> first
 * event), so the portal scan runs in any environment with a live server.
 */
async function resolveEventIdViaApi(page: Page): Promise<string | null> {
  try {
    const login = await page.request.post('/api/auth/login', {
      data: { email: 'owner@demo.local', password: 'wedding123' },
    });
    if (!login.ok()) return null;
    const { token } = (await login.json()) as { token: string };
    const headers = { Authorization: `Bearer ${token}` };

    const orgsRes = await page.request.get('/api/orgs', { headers });
    if (!orgsRes.ok()) return null;
    const orgs = (await orgsRes.json()) as { organizations?: Array<{ id: string }> };
    const orgId = orgs.organizations?.[0]?.id;
    if (!orgId) return null;

    const evtsRes = await page.request.get(`/api/orgs/${orgId}/events`, { headers });
    if (!evtsRes.ok()) return null;
    const evts = (await evtsRes.json()) as { events?: Array<{ id: string }> };
    return evts.events?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Print a compact, reviewer-friendly summary so CI logs are actionable. */
function reportViolations(label: string, violations: AxeViolation[]): void {
  if (violations.length === 0) return;
  const lines = violations.map(
    (v) =>
      `  • [${v.impact}] ${v.id} — ${v.help}\n` +
      `    ${v.helpUrl}\n` +
      `    nodes: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  console.error(`\n[a11y] ${label}: ${violations.length} violation(s):\n${lines.join('\n')}\n`);
}

test.describe('Accessibility @a11y', () => {
  test('login screen has no detectable WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');
    // The product name also appears in the footer; target the page heading so
    // Playwright's strict locator mode remains deterministic.
    await expect(page.getByRole('heading', { name: 'Wedding Venue Intelligence' })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    reportViolations('login screen', results.violations as AxeViolation[]);
    expect(results.violations).toHaveLength(0);
  });

  test('public guest portal has no detectable WCAG A/AA violations', async ({ page }) => {
    const eventId = seededEventId() ?? (await resolveEventIdViaApi(page));
    test.skip(!eventId, 'No seeded event id and no reachable API — skipping portal scan');

    await page.goto(`/#/portal/${eventId}`);

    // Wait for real content — the portal fetches event details async; axe
    // must analyze the rendered portal, not a loading shell.
    await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 });

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      // The interactive konva venue map renders to <canvas>; axe can't
      // introspect canvas internals, so scope it out to avoid false noise.
      .exclude('canvas')
      .analyze();
    reportViolations('guest portal (home)', results.violations as AxeViolation[]);
    expect(results.violations).toHaveLength(0);

    // The RSVP tab is the portal's highest-interaction surface (form
    // controls, radio groups, date pickers) — scan it too.
    await page.getByRole('button', { name: 'Open RSVP' }).click();
    await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 });
    const rsvpResults = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude('canvas')
      .analyze();
    reportViolations('guest portal (RSVP tab)', rsvpResults.violations as AxeViolation[]);
    expect(rsvpResults.violations).toHaveLength(0);
  });
});
