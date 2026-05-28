import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Blocks, CheckCircle2, ChevronRight, Circle, ExternalLink, Link2, Plus, RefreshCw, X } from 'lucide-react';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { useToast } from '../../ui/Toast';

interface Props {
  orgId: string;
}

const INTEGRATIONS_CATALOG = [
  { id: 'quickbooks', name: 'QuickBooks Online', category: 'accounting', description: 'Sync vendor payments, ledgers, and contract transactions.', icon: 'https://cdn.iconscout.com/icon/free/png-256/free-quickbooks-logo-icon-download-in-svg-png-gif-file-formats--technology-social-media-company-brand-vol-4-pack-logos-icons-2945110.png' },
  { id: 'stripe', name: 'Stripe', category: 'payments', description: 'Generate deposit links directly onto digital contracts.', icon: 'https://cdn.iconscout.com/icon/free/png-256/free-stripe-logo-icon-download-in-svg-png-gif-file-formats--technology-social-media-vol-6-pack-logos-icons-2945182.png' },
  { id: 'calendly', name: 'Calendly', category: 'calendar', description: 'Sync venue tours and booking consultations to the calendar.', icon: 'https://images.g2crowd.com/uploads/product/image/large_detail/large_detail_2e967a508b1c1c1fce9db50a7c4915ab/calendly.png' },
  { id: 'zola', name: 'Zola / The Knot', category: 'guests', description: 'Automatically ingest and map guest RSVPs from external sites.', icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Zola_Logo.png' },
  { id: 'google_sheets', name: 'Google Sheets', category: 'export', description: 'Live sync events, budgets, and guest pipelines to sheets.', icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Google_Sheets_logo_%282020%29.svg/1200px-Google_Sheets_logo_%282020%29.svg.png' },
];

export function IntegrationHub({ orgId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  
  // We mock active connections for now
  const [activeConnections, setActiveConnections] = useState<Record<string, { status: 'connected' | 'error', lastSync?: string }>>({
    'stripe': { status: 'connected', lastSync: new Date(Date.now() - 3600000).toISOString() }
  });

  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = (id: string) => {
    setConnecting(id);
    // Simulate OAuth flow delay
    setTimeout(() => {
      setActiveConnections(prev => ({
        ...prev,
        [id]: { status: 'connected', lastSync: new Date().toISOString() }
      }));
      setConnecting(null);
      toast({ title: 'Integration connected successfully', variant: 'success' });
    }, 1500);
  };

  const handleDisconnect = (id: string) => {
    if (window.confirm('Disconnect this integration? This will halt all active syncing.')) {
      const next = { ...activeConnections };
      delete next[id];
      setActiveConnections(next);
      toast({ title: 'Integration removed' });
    }
  };

  const forceSync = (id: string) => {
    toast({ title: 'Sync triggered', description: 'Data is being reconciled in the background.' });
    setTimeout(() => {
      setActiveConnections(prev => ({
        ...prev,
        [id]: { ...prev[id], lastSync: new Date().toISOString() }
      }));
    }, 1000);
  };

  return (
    <>
      <PageHeader
        title="Integration Hub"
        description="Connect external tools to automate your venue operations."
      />
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
             {INTEGRATIONS_CATALOG.map(integration => {
                const active = activeConnections[integration.id];
                
                return (
                  <Card key={integration.id} className="overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 gap-4">
                       <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-surface border border-border flex items-center justify-center p-2 shrink-0 bg-white shadow-sm">
                             <img src={integration.icon} alt={integration.name} className="w-full h-full object-contain" onError={(e) => (e.target as any).style.display = 'none'} />
                          </div>
                          <div>
                             <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-base">{integration.name}</h3>
                                {active && (
                                   <Badge variant={active.status === 'connected' ? 'success' : 'danger'} className="text-[10px] uppercase">
                                     {active.status}
                                   </Badge>
                                )}
                             </div>
                             <p className="text-sm text-fg-muted max-w-md">{integration.description}</p>
                             
                             {active && active.lastSync && (
                                <div className="flex items-center gap-1 mt-2 text-xs text-fg-subtle">
                                   <RefreshCw className="w-3 h-3" />
                                   Last synced: {new Date(active.lastSync).toLocaleString()}
                                </div>
                             )}
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t border-border sm:border-t-0 pt-4 sm:pt-0 shrink-0">
                          {active ? (
                            <>
                               <Button variant="outline" size="sm" onClick={() => forceSync(integration.id)}>
                                 Sync Now
                               </Button>
                               <Button variant="secondary" size="sm" className="text-danger hover:text-danger hover:bg-danger/10" onClick={() => handleDisconnect(integration.id)}>
                                 Disconnect
                               </Button>
                            </>
                          ) : (
                             <Button size="sm" onClick={() => handleConnect(integration.id)} disabled={connecting === integration.id}>
                               {connecting === integration.id ? 'Connecting...' : 'Connect'}
                             </Button>
                          )}
                       </div>
                    </div>
                  </Card>
                );
             })}
          </div>

          <div className="space-y-6">
             <Card>
               <CardHeader>
                 <CardTitle className="text-base flex items-center gap-2">
                   <Link2 className="w-4 h-4 text-brand" /> Webhooks & API
                 </CardTitle>
                 <CardDescription>Build custom connections</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                 <p className="text-sm text-fg-muted">
                    Need to push data to an unsupported tool? Use our Zapier/Make webhooks to trigger generic POST requests when events occur.
                 </p>
                 <div className="bg-surface-2 p-3 rounded border border-border font-mono text-[10px] text-fg-subtle break-all">
                    https://api.wvi.platform/v1/webhooks/org_abc123/events
                 </div>
                 <Button variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-1" /> Add Webhook Target
                 </Button>
               </CardContent>
             </Card>

             <Card>
               <CardHeader>
                 <CardTitle className="text-base">Data Export</CardTitle>
               </CardHeader>
               <CardContent className="space-y-3">
                 <Button variant="outline" className="w-full justify-between group">
                    Export All Guests (CSV) <ExternalLink className="w-4 h-4 text-fg-subtle group-hover:text-fg" />
                 </Button>
                 <Button variant="outline" className="w-full justify-between group">
                    Export Financials (JSON) <ExternalLink className="w-4 h-4 text-fg-subtle group-hover:text-fg" />
                 </Button>
                 <Button variant="outline" className="w-full justify-between group">
                    Export Vendors (CSV) <ExternalLink className="w-4 h-4 text-fg-subtle group-hover:text-fg" />
                 </Button>
               </CardContent>
             </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}
