import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./recovery', async () => {
  const actual = await vi.importActual<typeof import('./recovery')>('./recovery');

  return {
    ...actual,
    buildProjectHealthReport: () => ({
      generatedAt: new Date().toISOString(),
      overallStatus: 'warning' as const,
      domains: [
        {
          key: 'spm_venues',
          label: 'Venues',
          status: 'healthy' as const,
          message: 'Stored JSON parsed successfully.',
          sizeBytes: 12,
        },
      ],
    }),
  };
});

import {
  buildRecoveryDiagnosticsReport,
} from './recoveryDiagnostics';

describe('recovery diagnostics', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds a diagnostics report with health info and recovery domains', () => {
    const report = buildRecoveryDiagnosticsReport();

    expect(report.generatedAt).toBeTruthy();
    expect(report.report.overallStatus).toBe('warning');
    expect(Array.isArray(report.report.domains)).toBe(true);
    expect(Array.isArray(report.domains)).toBe(true);
    expect(report.domains.some((d) => d.key === 'spm_venues')).toBe(true);
  });

  it('includes domain labels and keys', () => {
    const report = buildRecoveryDiagnosticsReport();

    expect(report.domains.length).toBeGreaterThan(0);
    expect(report.domains[0]).toHaveProperty('key');
    expect(report.domains[0]).toHaveProperty('label');
  });
});