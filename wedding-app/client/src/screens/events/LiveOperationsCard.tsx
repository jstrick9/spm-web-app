import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';

export function LiveOperationsCard({ eventId, board, isLoading }: { eventId: string; board?: any; isLoading: boolean }) {
  const open = (tab: string) => { window.location.hash = `#/events/${eventId}?tab=${tab}`; };
  const metrics = [
    [board?.tasks?.length ?? 0, 'open tasks'],
    [board?.shifts?.filter((shift: any) => shift.clocked_in_at && !shift.clocked_out_at).length ?? 0, 'clocked in'],
    [board?.vendors?.length ?? 0, 'vendors'],
    [board?.incidents?.length ?? 0, 'open incidents'],
    [board?.layouts?.length ?? 0, 'layouts'],
  ];
  return <Card className="border-brand/30"><CardHeader><CardTitle>Live Event Week operations</CardTitle><CardDescription>Current venue execution signals for tasks, staff, vendors, incidents, and layouts.</CardDescription></CardHeader><CardContent>{isLoading ? <p className="text-sm text-fg-muted">Loading live operations…</p> : <><div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">{metrics.map(([value, label]) => <div key={String(label)} className="rounded border border-border p-2"><strong>{value}</strong><p className="text-fg-muted">{label}</p></div>)}</div><div className="mt-3 grid gap-2 lg:grid-cols-3"><section className="rounded border border-border p-2 text-sm"><div className="flex justify-between"><strong>Priority tasks</strong><Button size="xs" variant="ghost" onClick={() => open('staff')}>Open</Button></div>{board?.tasks?.slice(0, 3).map((task: any) => <p key={task.id} className="mt-1 text-fg-muted">{task.priority} · {task.title}</p>) || <p className="text-fg-muted">No open tasks.</p>}</section><section className="rounded border border-border p-2 text-sm"><div className="flex justify-between"><strong>Vendor load-in</strong><Button size="xs" variant="ghost" onClick={() => open('vendors')}>Open</Button></div>{board?.vendors?.slice(0, 3).map((vendor: any) => <p key={vendor.id} className="mt-1 text-fg-muted">{vendor.name}{vendor.loadIn ? ` · ${vendor.loadIn}` : ''}</p>) || <p className="text-fg-muted">No vendors.</p>}</section><section className="rounded border border-border p-2 text-sm"><div className="flex justify-between"><strong>Unresolved incidents</strong><Button size="xs" variant="ghost" onClick={() => open('timeline')}>Open</Button></div>{board?.incidents?.slice(0, 3).map((incident: any) => <p key={incident.id} className="mt-1 text-fg-muted">{incident.severity} · {incident.note}</p>) || <p className="text-fg-muted">No unresolved incidents.</p>}</section></div></>}</CardContent></Card>;
}
