/**
 * EventContractsTab — Phase 21: wired to real contracts backend.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSignature, Plus, Download, CheckCircle2, Send, Trash2, AlertTriangle, ShieldAlert, ClipboardCheck, LockKeyhole, Scale, Truck, Wine, Volume2, Clock, Sparkles } from 'lucide-react';
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

type FinancialLegalEscalation = { id: string; type: 'contract' | 'payment' | 'legal'; label: string; severity: 'warning' | 'blocked'; createdAt: string; status: 'open' | 'resolved' };

function parseMetadata(raw: unknown): Record<string, any> {
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw as Record<string, any>; } catch { return {}; }
}

function contractObligations(contract: SdkContract) {
  const haystack = `${contract.title} ${contract.content || ''}`.toLowerCase();
  const rules = [
    { key: 'load-in', icon: Truck, label: 'Load-in / strike', terms: ['load-in', 'load in', 'loadout', 'load-out', 'strike', 'delivery', 'setup'] },
    { key: 'insurance', icon: ShieldAlert, label: 'Insurance / COI', terms: ['insurance', 'coi', 'certificate of insurance', 'liability'] },
    { key: 'cleanup', icon: ClipboardCheck, label: 'Cleanup / damage', terms: ['cleanup', 'clean up', 'trash', 'damage', 'deposit', 'breakdown'] },
    { key: 'alcohol', icon: Wine, label: 'Alcohol / bar', terms: ['alcohol', 'bar', 'liquor', 'beer', 'wine', 'bartender'] },
    { key: 'noise', icon: Volume2, label: 'Noise / music', terms: ['noise', 'music', 'dj', 'band', 'decibel', 'sound ordinance'] },
    { key: 'overtime', icon: Clock, label: 'Overtime / curfew', terms: ['overtime', 'curfew', 'end time', 'late fee', 'extension'] },
  ];
  return rules.filter(rule => rule.terms.some(term => haystack.includes(term)));
}

function contractRisk(contracts: SdkContract[]) {
  const pending = contracts.filter(c => c.status === 'sent');
  const draft = contracts.filter(c => c.status === 'draft');
  const expired = contracts.filter(c => c.status === 'expired');
  const unsignedOperational = contracts.filter(c => c.status !== 'signed' && contractObligations(c).length > 0);
  return { pending, draft, expired, unsignedOperational };
}

export function EventContractsTab({ eventId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = usePermission('contracts.manage');
  const canSign = usePermission('contracts.sign');
  // MODULE-06 FI-03: owner-only gate for approving blocked go/no-go flags
  // (org.manage is held by the owner role only — admins cannot destroy orgs).
  const isOwner = usePermission('org.manage');
  // MODULE-06 FI-11: raising escalations requires the dedicated permission.
  const canEscalate = usePermission('financial_legal.escalate');
  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';
  const [createOpen, setCreateOpen] = useState(false);
  const [signTarget, setSignTarget] = useState<SdkContract | null>(null);
  const [printTarget, setPrintTarget] = useState<SdkContract | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', eventId],
    queryFn: () => sdk.contracts.list(eventId),
  });

  const { data: eventData } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => sdk.events.get(eventId),
  });

  const { data: financialLegalData } = useQuery({
    queryKey: ['financial-legal', eventId],
    queryFn: () => sdk.contracts.financialLegal(eventId),
    enabled: managerMode || canManage,
  });

  const contracts = data?.contracts ?? [];
  const totalActive = contracts.filter(c => c.status !== 'expired').length;
  const pending = contracts.filter(c => c.status === 'sent').length;
  const executed = contracts.filter(c => c.status === 'signed').length;
  const totalValue = contracts.reduce((s, c) => s + (c.amount_cents ?? 0), 0);
  const risks = contractRisk(contracts);
  const eventMetadata = parseMetadata(eventData?.event?.metadata);
  const legacyEscalations: FinancialLegalEscalation[] = Array.isArray(eventMetadata.financialLegalEscalations) ? eventMetadata.financialLegalEscalations : [];
  const legacyNoProceedFlags: FinancialLegalEscalation[] = Array.isArray(eventMetadata.noProceedFinancialLegalFlags) ? eventMetadata.noProceedFinancialLegalFlags : [];
  const escalations = (financialLegalData?.financialLegal.escalations || legacyEscalations) as any[];
  const noProceedFlags = (financialLegalData?.financialLegal.goNoGoFlags || legacyNoProceedFlags) as any[];
  const backendExtracts = financialLegalData?.financialLegal.obligationExtracts || [];

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

  const createEscalationMutation = useMutation({
    mutationFn: ({ type, label, blocked }: { type: FinancialLegalEscalation['type']; label: string; blocked: boolean }) =>
      sdk.contracts.createFinancialLegalEscalation(eventId, { sourceType: type, label, severity: blocked ? 'blocked' : 'warning', createGoNoGoFlag: blocked }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['financial-legal', eventId] });
      toast({ title: 'Issue escalated', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Escalation failed', description: e.message, variant: 'destructive' }),
  });

  const addEscalation = (type: FinancialLegalEscalation['type'], label: string, blocked = false) => {
    createEscalationMutation.mutate({ type, label, blocked });
  };

  // MODULE-06 FI-03/FI-04: obligation decisions + go/no-go flag lifecycle.
  const decideObligationMutation = useMutation({
    mutationFn: ({ contractId, obligationId, status }: { contractId: string; obligationId: string; status: 'approved' | 'dismissed' }) =>
      sdk.contracts.decideObligation(contractId, obligationId, status),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-legal', eventId] }); toast({ title: 'Obligation updated', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  const flagActionMutation = useMutation({
    mutationFn: ({ flagId, action }: { flagId: string; action: 'approve' | 'resolve' }) =>
      action === 'approve' ? sdk.contracts.approveGoNoGoFlag(eventId, flagId) : sdk.contracts.resolveGoNoGoFlag(eventId, flagId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-legal', eventId] }); toast({ title: 'Go/No-Go flag updated', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Flag update failed', description: e.message, variant: 'destructive' }),
  });

  const extractObligationsMutation = useMutation({
    mutationFn: (contractId: string) => sdk.contracts.extractObligations(contractId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['financial-legal', eventId] }); toast({ title: 'Obligations re-extracted', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Extraction failed', description: e.message, variant: 'destructive' }),
  });

  const handleCreate = (data: any) => {
    const amount = data.amountStr ? Number(String(data.amountStr).replace(/[^0-9.]/g, '')) : undefined;
    createMutation.mutate({
      title: data.title,
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail || undefined,
      amountCents: amount !== undefined && !Number.isNaN(amount) ? Math.round(amount * 100) : undefined,
      content: data.content,
    });
  };

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
      <Card className="border-brand/20 bg-brand-soft/20">
        <CardContent className="p-4 text-sm text-fg-muted space-y-2">
          <h2 className="font-bold text-brand">Contracts, signatures, and audit certificates</h2>
          <p>Use the contract template wizard to draft agreements from venue, vendor, or couple templates. Signed contracts generate an e-sign audit certificate with signer, timestamp, and stored signature data.</p>
          {pending > 0 && <div className="rounded border border-warning/30 bg-warning-soft p-2 text-warning font-semibold">Contract missing-signature alert: {pending} contract{pending === 1 ? '' : 's'} waiting for signature.</div>}
        </CardContent>
      </Card>

      {(managerMode || !canManage) && (
        <ManagerContractOperationsPanel
          contracts={contracts}
          canManage={canManage}
          risks={risks}
          escalations={escalations}
          isOwner={isOwner}
          canEscalate={canEscalate}
          onDecideObligation={(contractId, obligationId, status) => decideObligationMutation.mutate({ contractId, obligationId, status })}
          onFlagAction={(flagId, action) => flagActionMutation.mutate({ flagId, action })}
          onReextract={(contractId) => extractObligationsMutation.mutate(contractId)}
          noProceedFlags={noProceedFlags}
          backendExtracts={backendExtracts}
          onEscalate={addEscalation}
        />
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
        <StatCard label="Total Active" value={totalActive} />
        <StatCard label="Pending Signature" value={pending} />
        <StatCard label="Fully Executed" value={executed} />
        <StatCard label="Total Value" value={canManage ? (totalValue > 0 ? `$${(totalValue / 100).toLocaleString()}` : '—') : 'Limited'} description={!canManage ? 'Ask owner/admin for financial detail' : undefined} />
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
                        {c.amount_cents != null && (canManage ? ` · $${(c.amount_cents / 100).toLocaleString()}` : ' · financial visibility limited')}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-fg-subtle">
                        {c.sent_at && <span>Sent {new Date(c.sent_at).toLocaleDateString()}</span>}
                        {c.signed_at && (
                          <span className="flex items-center gap-1 text-success">
                            <CheckCircle2 className="h-3 w-3" /> Signed {new Date(c.signed_at).toLocaleDateString()}
                          </span>
                        )}
                        {c.status === 'signed' && <span className="text-success font-semibold">E-sign audit certificate ready</span>}
                      </div>
                      <ContractClauseHighlights contract={c} />
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


function ManagerContractOperationsPanel({ contracts, canManage, isOwner, canEscalate, risks, escalations, noProceedFlags, backendExtracts, onEscalate, onDecideObligation, onFlagAction, onReextract }: {
  contracts: SdkContract[];
  canManage: boolean;
  isOwner: boolean;
  canEscalate: boolean;
  risks: ReturnType<typeof contractRisk>;
  escalations: FinancialLegalEscalation[];
  noProceedFlags: any[];
  backendExtracts: Array<{ id: string; contract_id: string; obligation_key: string; label: string; excerpt: string | null; confidence: string; status: string }>;
  onEscalate: (type: FinancialLegalEscalation['type'], label: string, blocked?: boolean) => void;
  onDecideObligation: (contractId: string, obligationId: string, status: 'approved' | 'dismissed') => void;
  onFlagAction: (flagId: string, action: 'approve' | 'resolve') => void;
  onReextract: (contractId: string) => void;
}) {
  const signed = contracts.filter(c => c.status === 'signed').length;
  const operationalObligations = backendExtracts.length
    ? backendExtracts.map(extract => ({ contract: contracts.find(c => c.id === extract.contract_id), obligation: { key: extract.obligation_key, label: extract.label, icon: Scale }, excerpt: extract.excerpt, confidence: extract.confidence, status: extract.status, id: extract.id })).filter((row: any) => row.contract)
    : contracts.flatMap(contract => contractObligations(contract).map(obligation => ({ contract, obligation, status: undefined, id: undefined }))); 
  const goNoGo = [
    { label: 'Venue/couple agreement fully executed', ok: contracts.some(c => c.status === 'signed') },
    { label: 'No expired contracts attached to event', ok: risks.expired.length === 0 },
    { label: 'No operational contract waiting signature', ok: risks.unsignedOperational.length === 0 },
    { label: 'No active do-not-proceed legal/financial flag', ok: noProceedFlags.filter(f => f.status === 'open').length === 0 },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-brand/20 bg-brand-soft/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> Manager contract operations summary</CardTitle>
          <CardDescription>Manager-safe view of legal/financial blockers and day-of obligations. Owner/admin-only fields stay protected.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManage && (
            <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-sm text-warning flex gap-2">
              <LockKeyhole className="h-4 w-4 shrink-0" /> Financial visibility limited: you can review operational status and escalation needs, but exact legal/financial editing is owner/admin only.
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-4">
            <MiniOpsMetric label="Signed" value={`${signed}/${contracts.length}`} />
            <MiniOpsMetric label="Pending" value={risks.pending.length} />
            <MiniOpsMetric label="Operational clauses" value={operationalObligations.length} />
            <MiniOpsMetric label="No-go flags" value={noProceedFlags.filter(f => f.status === 'open').length} danger={noProceedFlags.some(f => f.status === 'open')} />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-fg-subtle">Operations obligations extractor</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {operationalObligations.slice(0, 8).map(({ contract, obligation, status, id }) => {
                const Icon = obligation.icon;
                return <div key={`${contract?.id || 'contract'}-${obligation.key}`} className="rounded-lg border border-border bg-surface p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-brand flex items-center gap-1"><Icon className="h-3.5 w-3.5" />{obligation.label}</div>
                    {status && status !== 'detected' && <Badge variant={status === 'approved' ? 'success' : 'default'} className="text-[9px]">{status}</Badge>}
                  </div>
                  <div className="text-fg-muted">{contract?.title}</div>
                  {canManage && status === 'detected' && id && contract?.id && (
                    <div className="mt-1.5 flex gap-1.5">
                      <Button size="xs" variant="outline" onClick={() => onDecideObligation(contract.id, id, 'approved')} className="text-[10px]">Approve</Button>
                      <Button size="xs" variant="ghost" onClick={() => onDecideObligation(contract.id, id, 'dismissed')} className="text-[10px]">Dismiss</Button>
                    </div>
                  )}
                </div>;
              })}
              {canManage && contracts.length > 0 && backendExtracts.length === 0 && (
                <Button size="xs" variant="outline" className="mt-1 justify-self-start" onClick={() => onReextract(contracts[0].id)}>
                  <Sparkles className="h-3 w-3" /> Re-extract obligations
                </Button>
              )}
              {operationalObligations.length === 0 && <p className="rounded-lg border border-dashed border-border bg-surface p-3 text-xs text-fg-muted">No day-of operational clauses detected yet. Add contract content mentioning load-in, insurance, cleanup, alcohol, noise, or overtime.</p>}
            </div>
          </div>
          {canEscalate && <div className="flex flex-wrap gap-2">
            {risks.pending.length > 0 && <Button size="sm" variant="outline" onClick={() => onEscalate('contract', `${risks.pending.length} contract(s) pending signature`)}><AlertTriangle className="h-4 w-4" /> Escalate pending signature</Button>}
            {risks.expired.length > 0 && <Button size="sm" variant="destructive" onClick={() => onEscalate('legal', `${risks.expired.length} expired contract(s) block event operations`, true)}>Do not proceed</Button>}
            {risks.unsignedOperational.length > 0 && <Button size="sm" variant="destructive" onClick={() => onEscalate('legal', 'Operational clauses exist in unsigned contracts', true)}>Block until owner approval</Button>}
          </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4 text-brand" /> Legal / financial go-no-go checklist</CardTitle>
          <CardDescription>Manager decision support: proceed only when legal and payment blockers are cleared or owner-approved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {goNoGo.map(item => <div key={item.label} className="flex gap-2 rounded-lg border border-border bg-surface p-2 text-sm"><span className={item.ok ? 'text-success' : 'text-danger'}>{item.ok ? '✓' : '!'}</span><span>{item.label}</span></div>)}
          {escalations.length > 0 && <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning"><strong>Open escalations:</strong><ul className="mt-1 space-y-1">{escalations.filter(e => e.status === 'open').slice(0, 4).map(e => <li key={e.id}>• {e.label}</li>)}</ul></div>}
          {noProceedFlags.filter(f => f.status === 'open').map(f => (
            <div key={f.id} className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
              <div className="font-semibold">Do not proceed without owner approval: {f.label}</div>
              <div className="mt-2 flex gap-1.5">
                {isOwner && <Button size="xs" variant="outline" onClick={() => onFlagAction(f.id, 'approve')} className="text-[10px]">Approve (owner)</Button>}
                {canManage && <Button size="xs" variant="ghost" onClick={() => onFlagAction(f.id, 'resolve')} className="text-[10px]">Resolve</Button>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ContractClauseHighlights({ contract }: { contract: SdkContract }) {
  const obligations = contractObligations(contract);
  if (obligations.length === 0) return null;
  return <div className="mt-3 flex flex-wrap gap-1.5">{obligations.map(obligation => { const Icon = obligation.icon; return <Badge key={obligation.key} variant="outline" className="text-[10px]"><Icon className="mr-1 h-3 w-3" />{obligation.label}</Badge>; })}</div>;
}

function MiniOpsMetric({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="text-[10px] uppercase tracking-wider text-fg-subtle font-bold">{label}</div><div className={danger ? 'text-xl font-bold text-danger' : 'text-xl font-bold text-fg'}>{value}</div></div>;
}
