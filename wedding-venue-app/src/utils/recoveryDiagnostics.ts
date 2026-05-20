import { RECOVERY_DOMAINS, buildProjectHealthReport } from './recovery';

export interface RecoveryDiagnosticsReport {
  generatedAt: string;
  report: ReturnType<typeof buildProjectHealthReport>;
  domains: Array<{
    key: string;
    label: string;
  }>;
}

export function buildRecoveryDiagnosticsReport(): RecoveryDiagnosticsReport {
  return {
    generatedAt: new Date().toISOString(),
    report: buildProjectHealthReport(),
    domains: RECOVERY_DOMAINS.map((domain) => ({
      key: domain.key,
      label: domain.label,
    })),
  };
}

export function downloadRecoveryDiagnosticsReport(): void {
  const report = buildRecoveryDiagnosticsReport();
  const content = JSON.stringify(report, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `spm-recovery-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
}