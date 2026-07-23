import { test, expect } from '@playwright/test';
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
 * absent, the portal test is skipped rather than failing spuriously.
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
    const eventId = seededEventId();
    test.skip(!eventId, 'No seeded event id (.a11y-event-id) — skipping portal scan');

    await page.goto(`/#/portal/${eventId}`);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      // The interactive konva venue map renders to <canvas>; axe can't
      // introspect canvas internals, so scope it out to avoid false noise.
      .exclude('canvas')
      .analyze();
    reportViolations('guest portal', results.violations as AxeViolation[]);
    expect(results.violations).toHaveLength(0);
  });
});
