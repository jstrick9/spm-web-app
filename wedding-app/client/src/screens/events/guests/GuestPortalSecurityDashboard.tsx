import { useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { sdk } from '../../../sdk';
import { Badge } from '../../../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';

export function GuestPortalSecurityDashboard({ eventId }: { eventId: string }) {
  const query = useQuery({ queryKey: ['guest-portal-security', eventId], queryFn: () => sdk.guests.guestPortalSecurity(eventId) });
  const data = query.data;
  return (
    <Card className="border-warning/30 bg-warning-soft/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4" /> Guest portal audit/security dashboard</CardTitle>
        <CardDescription>Public portal views, token failures, lookup failures, honeypot/rate-limit adjacent suspicious activity, and privacy posture.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <SecurityStat label="Audits" value={data?.summary.totalAudits ?? 0} />
          <SecurityStat label="Suspicious" value={data?.summary.suspiciousCount ?? 0} variant={(data?.summary.suspiciousCount || 0) ? 'warning' : 'success'} />
          <SecurityStat label="Device sessions" value={data?.summary.uniqueDeviceSessions ?? 0} />
          <SecurityStat label="Tokenized preferred" value={data?.summary.tokenizedLinksPreferred ? 'Yes' : 'No'} variant="success" />
          <SecurityStat label="Directory exposed" value={data?.summary.genericGuestDirectoryExposed ? 'Yes' : 'No'} variant={data?.summary.genericGuestDirectoryExposed ? 'warning' : 'success'} />
          <SecurityStat label="Honeypots/rates" value={data?.summary.rateLimitsAndHoneypotsActive ? 'Active' : 'Check'} variant={data?.summary.rateLimitsAndHoneypotsActive ? 'success' : 'warning'} />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-fg-muted">Suspicious / failed public activity</h4>
            <div className="mt-2 space-y-2">{(data?.suspicious || []).slice(0, 6).map((row) => <AuditRow key={row.id} row={row} />)}{!(data?.suspicious || []).length && <p className="text-xs text-fg-muted">No suspicious guest portal activity in the recent audit window.</p>}</div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-fg-muted">Recent public portal audits</h4>
            <div className="mt-2 space-y-2">{(data?.audits || []).slice(0, 6).map((row) => <AuditRow key={row.id} row={row} />)}{!(data?.audits || []).length && <p className="text-xs text-fg-muted">No public portal audit records yet.</p>}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityStat({ label, value, variant = 'outline' }: { label: string; value: string | number; variant?: 'outline' | 'success' | 'warning' }) {
  return <div className="rounded-lg border border-border bg-surface p-2"><div className="text-[10px] uppercase font-bold text-fg-muted">{label}</div><Badge variant={variant}>{value}</Badge></div>;
}

function AuditRow({ row }: { row: Record<string, any> }) {
  return <div className="rounded-md border border-border p-2 text-xs"><div className="flex flex-wrap items-center gap-2"><strong>{String(row.action || '').replace(/^public\./, '')}</strong><Badge variant="outline">{row.deviceSession || 'no device key'}</Badge></div><p className="text-fg-muted">{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''} · {row.targetType || 'target'} {row.targetId || ''}</p></div>;
}
