/**
 * EventContractsTab — Phase 21: wired to real contracts backend.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSignature, Plus, Download, CheckCircle2, Send, Trash2 } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { SdkContract } from '../../../sdk/contracts';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { Skeleton } from '../../../ui/Skeleton';
import { useToast } from '../../../ui/Toast';
import { usePermission } from '../../../lib/usePermission';
import { StatCard } from '../../../ui/StatCard';
import { ContractFormDialog } from './ContractFormDialog';
import { ESignatureDialog } from './ESignatureDialog';
import { ContractPrintView } from './ContractPrintView';

interface Props { eventId: string }

const STATUS_BADGE: Record<string, { variant: 'default' | 'warning' | 'success' | 'danger'; label: string }> = {
  draft:   { variant: 'default', label: 'Draft' },
  sent:    { variant: 'warning', label: 'Sent' },
  signed:  { variant: 'success', label: 'Signed' },
  expired: { variant: 'danger',  label: 'Expired' },
};

export function EventContractsTab({ eventId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = usePermission('contracts.manage');
  const canSign = usePermission('contracts.sign');
  const [createOpen, setCreateOpen] = useState(false);
  const [signTarget, setSignTarget] = useState<SdkContract | null>(null);
  const [printTarget, setPrintTarget] = useState<SdkContract | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', eventId],
    queryFn: () => sdk.contracts.list(eventId),
  });

  const contracts = data?.contracts ?? [];
  const totalActive = contracts.filter(c => c.status !== 'expired').length;
  const pending = contracts.filter(c => c.status === 'sent').length;
  const executed = contracts.filter(c => c.status === 'signed').length;
  const totalValue = contracts.reduce((s, c) => s + (c.amount_cents ?? 0), 0);

  const sendMutation = useMutation({
    mutationFn: (id: string) => sdk.contracts.send(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts', eventId] }); toast({ title: 'Contract sent', variant: 'success' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.contracts.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts', eventId] }); toast({ title: 'Contract removed', variant: 'success' }); },
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; recipientName: string; recipientEmail?: string; amountCents?: number; content?: string }) =>
      sdk.contracts.create(eventId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts', eventId] });
      toast({ title: 'Contract created', variant: 'success' });
      setCreateOpen(false);
    },
    onError: () => toast({ title: 'Could not create contract', variant: 'destructive' }),
  });

  const handleCreate = (data: any) => createMutation.mutate(data);

  const signMutation = useMutation({
    mutationFn: ({ contractId, signature }: { contractId: string; signature: string }) =>
      sdk.contracts.sign(contractId, signature),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts', eventId] });
      toast({ title: 'Contract signed', variant: 'success' });
      setSignTarget(null);
    },
    onError: () => toast({ title: 'Could not sign contract', variant: 'destructive' }),
  });

  const handleSign = (contract: SdkContract, sig: string) =>
    signMutation.mutate({ contractId: contract.id, signature: sig });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
        <StatCard label="Total Active" value={totalActive} />
        <StatCard label="Pending Signature" value={pending} />
        <StatCard label="Fully Executed" value={executed} />
        <StatCard label="Total Value" value={totalValue > 0 ? `$${(totalValue / 100).toLocaleString()}` : '—'} />
      </div>

      {/* Actions */}
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Contract
          </Button>
        </div>
      )}

      {/* Contract list */}
      {contracts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-fg-muted text-sm">
            <FileSignature className="h-8 w-8 mx-auto mb-2 text-fg-subtle" />
            No contracts yet.{canManage && ' Click "New Contract" to create one.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contracts.map(c => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.draft;
            return (
              <Card key={c.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-fg truncate">{c.title}</h3>
                        <Badge variant={badge.variant} className="text-[10px] shrink-0">{badge.label}</Badge>
                      </div>
                      <p className="text-sm text-fg-muted">
                        {c.recipient_name}
                        {c.amount_cents != null && ` · $${(c.amount_cents / 100).toLocaleString()}`}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-fg-subtle">
                        {c.sent_at && <span>Sent {new Date(c.sent_at).toLocaleDateString()}</span>}
                        {c.signed_at && (
                          <span className="flex items-center gap-1 text-success">
                            <CheckCircle2 className="h-3 w-3" /> Signed {new Date(c.signed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      {c.status === 'draft' && canManage && (
                        <Button size="sm" variant="outline" onClick={() => sendMutation.mutate(c.id)}>
                          <Send className="h-3 w-3 mr-1" /> Send
                        </Button>
                      )}
                      {c.status === 'sent' && canSign && (
                        <Button size="sm" onClick={() => setSignTarget(c)}>
                          <FileSignature className="h-3 w-3 mr-1" /> Sign
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setPrintTarget(c)}>
                        <Download className="h-3 w-3" />
                      </Button>
                      {canManage && (
                        <button onClick={() => { if (window.confirm('Delete this contract?')) deleteMutation.mutate(c.id); }} className="p-1 text-fg-subtle hover:text-danger rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      {createOpen && (
        <ContractFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSave={handleCreate}
        />
      )}
      {signTarget && (
        <ESignatureDialog
          contract={signTarget as any}
          open={!!signTarget}
          onOpenChange={() => setSignTarget(null)}
          onSign={(id: string, sig: string) => handleSign(signTarget, sig)}
        />
      )}
      {printTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-8" onClick={() => setPrintTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full max-h-[80vh] overflow-auto text-black" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">{printTarget.title}</h2>
              <Button size="sm" onClick={() => { window.print(); }}>Print</Button>
            </div>
            <p className="text-sm text-gray-600 mb-2">Recipient: {printTarget.recipient_name}</p>
            {printTarget.amount_cents != null && <p className="text-sm text-gray-600 mb-4">Amount: ${(printTarget.amount_cents / 100).toLocaleString()}</p>}
            <div className="whitespace-pre-wrap text-sm border-t pt-4">{printTarget.content || "No content yet."}</div>
            {printTarget.signature && <p className="mt-6 italic text-success">Signed by: {printTarget.signature}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
