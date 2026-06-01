/**
 * IntegrationHub — Phase 20: real webhook management wired to backend.
 * 
 * Left column: third-party integration catalog (simulated connections — 
 * real OAuth will come when providers are wired).
 * Right column: real webhook CRUD from the backend.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Blocks, CheckCircle2, ExternalLink, Link2, Plus, RefreshCw,
  Trash2, Send, Globe, Activity,
} from 'lucide-react';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { useToast } from '../../ui/Toast';
import { sdk } from '../../sdk';
import type { SdkWebhook } from '../../sdk/webhooks';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../ui/Dialog';

interface Props { orgId: string }

const INTEGRATIONS_CATALOG = [
  { id: 'quickbooks', name: 'QuickBooks Online', category: 'accounting', description: 'Sync vendor payments and contract transactions.' },
  { id: 'stripe', name: 'Stripe', category: 'payments', description: 'Generate deposit links on digital contracts.' },
  { id: 'calendly', name: 'Calendly', category: 'calendar', description: 'Sync venue tours to the calendar.' },
  { id: 'zola', name: 'Zola / The Knot', category: 'guests', description: 'Ingest guest RSVPs from external sites.' },
  { id: 'google_sheets', name: 'Google Sheets', category: 'export', description: 'Live sync events and budgets to sheets.' },
];

export function IntegrationHub({ orgId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  // ─── Real webhook data from backend ───────────────────
  const webhooksQuery = useQuery({
    queryKey: ['webhooks', orgId],
    queryFn: () => sdk.webhooks.list(orgId),
  });

  const webhooks = webhooksQuery.data?.webhooks ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.webhooks.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', orgId] });
      toast({ title: 'Webhook removed', variant: 'success' });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => sdk.webhooks.test(id),
    onSuccess: () => {
      toast({ title: 'Test webhook dispatched', description: 'Check delivery log for results.', variant: 'success' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      sdk.webhooks.update(id, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', orgId] });
    },
  });

  // ─── Simulated integration connections ────────────────
  const [activeConnections, setActiveConnections] = useState<Record<string, { status: 'connected' | 'error'; lastSync?: string }>>({});
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = (id: string) => {
    setConnecting(id);
    setTimeout(() => {
      setActiveConnections(prev => ({
        ...prev,
        [id]: { status: 'connected', lastSync: new Date().toISOString() }
      }));
      setConnecting(null);
      toast({ title: 'Integration connected', variant: 'success' });
    }, 1500);
  };

  return (
    <>
      <PageHeader
        title="Integration Hub"
        description="Connect external tools and configure outbound webhooks."
      />
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: Integration catalog */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-sm font-medium uppercase tracking-wider text-fg-subtle">Third-Party Integrations</h2>
            {INTEGRATIONS_CATALOG.map(integration => {
              const active = activeConnections[integration.id];
              return (
                <Card key={integration.id}>
                  <div className="flex items-center justify-between p-5 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0">
                        <Blocks className="w-5 h-5 text-fg-muted" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{integration.name}</h3>
                          {active && (
                            <Badge variant={active.status === 'connected' ? 'success' : 'danger'} className="text-[10px]">
                              {active.status}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-fg-muted">{integration.description}</p>
                        {active?.lastSync && (
                          <p className="text-[11px] text-fg-subtle mt-1 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" /> Last sync: {new Date(active.lastSync).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {active ? (
                      <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>
                    ) : (
                      <Button size="sm" onClick={() => handleConnect(integration.id)} disabled={connecting === integration.id}>
                        {connecting === integration.id ? 'Connecting…' : 'Connect'}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Right: Webhooks + Data Export */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-brand" /> Outbound Webhooks
                </CardTitle>
                <CardDescription>POST event payloads to external URLs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {webhooks.length === 0 ? (
                  <p className="text-sm text-fg-muted text-center py-4">No webhooks configured yet.</p>
                ) : (
                  webhooks.map(wh => (
                    <div key={wh.id} className="flex items-center justify-between gap-2 p-3 rounded-md border border-border bg-surface-2/30">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono truncate text-fg-muted">{wh.url}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={wh.is_active ? 'success' : 'default'} className="text-[10px]">
                            {wh.is_active ? 'Active' : 'Paused'}
                          </Badge>
                          {wh.last_status && (
                            <span className={`text-[10px] ${wh.last_status >= 200 && wh.last_status < 300 ? 'text-success' : 'text-danger'}`}>
                              Last: {wh.last_status}
                            </span>
                          )}
                          {wh.failure_count > 0 && (
                            <span className="text-[10px] text-danger">{wh.failure_count} failures</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleMutation.mutate({ id: wh.id, isActive: !wh.is_active })}
                          className="p-1 rounded hover:bg-surface-2 text-fg-subtle"
                          title={wh.is_active ? 'Pause' : 'Resume'}
                        >
                          <Activity className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => testMutation.mutate(wh.id)}
                          className="p-1 rounded hover:bg-surface-2 text-fg-subtle"
                          title="Send test" aria-label="Send test webhook"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => { if (window.confirm('Delete this webhook?')) deleteMutation.mutate(wh.id); }}
                          className="p-1 rounded hover:bg-surface-2 text-danger/60 hover:text-danger"
                          title="Delete" aria-label="Delete webhook"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}

                <AddWebhookDialog orgId={orgId} open={addOpen} onOpenChange={setAddOpen} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data Export</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a href={`/api/orgs/${orgId}/export/guests.csv`} download>
                  <Button variant="outline" className="w-full justify-between group">
                    Export All Guests (CSV) <ExternalLink className="w-4 h-4 text-fg-subtle group-hover:text-fg" />
                  </Button>
                </a>
                <a href={`/api/orgs/${orgId}/export/financials.json`} download>
                  <Button variant="outline" className="w-full justify-between group">
                    Export Financials (JSON) <ExternalLink className="w-4 h-4 text-fg-subtle group-hover:text-fg" />
                  </Button>
                </a>
                <a href={`/api/orgs/${orgId}/export/vendors.csv`} download>
                  <Button variant="outline" className="w-full justify-between group">
                    Export Vendors (CSV) <ExternalLink className="w-4 h-4 text-fg-subtle group-hover:text-fg" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

// ─── Add Webhook Dialog ─────────────────────────────────
function AddWebhookDialog({ orgId, open, onOpenChange }: {
  orgId: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [desc, setDesc] = useState('');

  const createMutation = useMutation({
    mutationFn: () => sdk.webhooks.create(orgId, {
      url,
      secret: secret || undefined,
      description: desc || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', orgId] });
      toast({ title: 'Webhook created', variant: 'success' });
      onOpenChange(false);
      setUrl(''); setSecret(''); setDesc('');
    },
    onError: () => {
      toast({ title: 'Invalid URL', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="w-4 h-4 mr-1" /> Add Webhook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Outbound Webhook</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>URL</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} className="mt-1 font-mono text-xs" placeholder="https://hooks.zapier.com/..." />
          </div>
          <div>
            <Label>Signing Secret (optional)</Label>
            <Input value={secret} onChange={e => setSecret(e.target.value)} className="mt-1" placeholder="whsec_..." />
            <p className="text-[11px] text-fg-subtle mt-1">Used to verify webhook authenticity via HMAC-SHA256</p>
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} className="mt-1" placeholder="Zapier — new RSVP trigger" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!url.trim() || createMutation.isPending} isLoading={createMutation.isPending}>
            Create Webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
