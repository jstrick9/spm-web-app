/**
 * GuestMergePanel — surfaces guest identity resolution suggestions.
 *
 * Used inside CrossEventGuestBrowser as a collapsible side panel.
 * Shows duplicate clusters (found by guestIdentityRepo.findDuplicates),
 * lets staff review matches by confidence tier, and confirm one-click merges.
 *
 * Design decisions:
 *  • Human-confirmed only — no silent auto-merge, ever.
 *  • High confidence (email/phone match) shown first.
 *  • Medium confidence (name-only) shown with a visual caution cue.
 *  • Dismiss (ignore) persists in localStorage to reduce noise on reload.
 *  • Every merge is audit-logged server-side.
 *  • Full RBAC: guests.view to see, guests.manage to merge/dismiss.
 *  • WCAG 2.1 AA: aria-labels, focus rings, role="status" on merge result.
 */
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Merge,
  X,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { sdk } from '../../sdk';
import { usePermission } from '../../lib/usePermission';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';
import type { GuestDuplicateCluster } from '../../sdk/guests';

// ── Local persistence of dismissed clusters ────────────────────────────────

const DISMISSED_KEY = 'wvi:dismissed-guest-clusters';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(keys: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...keys]));
  } catch {
    // storage quota — ignore
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface ClusterCardProps {
  cluster: GuestDuplicateCluster;
  canManage: boolean;
  onMerge: (primaryId: string, duplicateIds: string[]) => void;
  onDismiss: (key: string) => void;
  merging: boolean;
}

function ClusterCard({ cluster, canManage, onMerge, onDismiss, merging }: ClusterCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [primaryId, setPrimaryId] = useState<string>(cluster.members[0]?.id ?? '');

  const isHighConfidence = cluster.confidence === 'high';
  const signalIcons: Record<'email' | 'phone' | 'name', React.ReactNode> = {
    email: <Mail className="h-3 w-3" aria-label="Matched by email" />,
    phone: <Phone className="h-3 w-3" aria-label="Matched by phone" />,
    name: <Users className="h-3 w-3" aria-label="Matched by name" />,
  };

  const duplicateIds = cluster.members
    .map((m: any) => m.id)
    .filter((id: string) => id !== primaryId);

  return (
    <div
      className={[
        'rounded-lg border p-3 space-y-2 transition-colors',
        isHighConfidence ? 'border-warning/40 bg-warning/5' : 'border-border bg-surface-1',
      ].join(' ')}
      role="article"
      aria-label={`Duplicate cluster: ${cluster.members[0]?.fullName}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant={isHighConfidence ? 'warning' : 'default'}
            className="shrink-0 text-[10px]"
            aria-label={`Confidence: ${cluster.confidence}`}
          >
            {isHighConfidence ? '⚠ High' : '○ Medium'}
          </Badge>
          <span className="text-sm font-medium truncate">
            {cluster.members[0]?.fullName}
          </span>
          <span className="text-xs text-fg-subtle shrink-0">
            × {cluster.members.length}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Signal badges */}
          <div className="flex items-center gap-0.5 text-fg-muted" aria-label="Match signals">
            {cluster.signals.map((s: 'email' | 'phone' | 'name') => (
              <span key={s} className="p-0.5" title={`Matched by ${s}`}>
                {signalIcons[s]}
              </span>
            ))}
          </div>

          {/* Expand/collapse */}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse cluster details' : 'Expand cluster details'}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-fg-muted" />
            ) : (
              <ChevronDown className="h-4 w-4 text-fg-muted" />
            )}
          </button>

          {/* Dismiss */}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-danger"
            onClick={() => onDismiss(cluster.key)}
            aria-label="Dismiss this merge suggestion"
          >
            <X className="h-4 w-4 text-fg-muted" />
          </button>
        </div>
      </div>

      {/* In-event duplicate warning */}
      {cluster.hasInEventDuplicate && (
        <div className="flex items-center gap-1.5 text-xs text-danger" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Two or more records exist in the same event — likely a data entry duplicate.
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] text-fg-subtle font-medium uppercase tracking-wide">
            Members — select the primary record to keep
          </p>
          <ul className="space-y-1.5" role="radiogroup" aria-label="Select primary record">
            {cluster.members.map((m: any) => (
              <li key={m.id}>
                <label
                  className={[
                    'flex items-start gap-2.5 rounded-lg border p-2 cursor-pointer text-xs',
                    'hover:bg-surface-2 transition-colors',
                    primaryId === m.id ? 'border-brand bg-brand/5' : 'border-border',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name={`primary-${cluster.key}`}
                    value={m.id}
                    checked={primaryId === m.id}
                    onChange={() => setPrimaryId(m.id)}
                    className="mt-0.5 accent-brand"
                    aria-label={`Set ${m.fullName} from ${m.eventTitle} as primary`}
                    disabled={!canManage}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-fg truncate">{m.fullName}</div>
                    <div className="text-fg-muted truncate mt-0.5">
                      {m.email && (
                        <span className="inline-flex items-center gap-1 mr-2">
                          <Mail className="h-2.5 w-2.5" aria-hidden="true" /> {m.email}
                        </span>
                      )}
                      {m.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" aria-hidden="true" /> {m.phone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-fg-subtle">
                      <a
                        href={`#/events/${m.eventId}`}
                        className="inline-flex items-center gap-0.5 hover:underline text-brand"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`View event: ${m.eventTitle}`}
                        target="_self"
                      >
                        {m.eventTitle}
                        <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                      </a>
                      <span>· {m.rsvpStatus}</span>
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>

          {/* Action row */}
          {canManage && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => onMerge(primaryId, duplicateIds)}
                isLoading={merging}
                aria-label={`Merge ${cluster.members.length} records, keeping ${cluster.members.find((m: any) => m.id === primaryId)?.fullName}`}
              >
                <Merge className="h-4 w-4 mr-1" aria-hidden="true" /> Merge ({cluster.members.length} records)
              </Button>
              <p className="text-[11px] text-fg-subtle">
                Empty contact fields will be backfilled from duplicates. Duplicates are soft-deleted.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  onClose?: () => void;
}

export function GuestMergePanel({ orgId, onClose }: Props) {
  const canViewGuests = usePermission('guests.view');
  const canManageGuests = usePermission('guests.manage');
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [mergingKey, setMergingKey] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['guest-duplicates', orgId],
    queryFn: () => sdk.guests.duplicates(orgId),
    staleTime: 10 * 60_000, // expensive query — cache 10 min
    enabled: canViewGuests,
  });

  const mergeMutation = useMutation({
    mutationFn: ({ primaryId, duplicateIds }: { primaryId: string; duplicateIds: string[] }) =>
      sdk.guests.merge(orgId, primaryId, duplicateIds),
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: ['guest-duplicates', orgId] });
      qc.invalidateQueries({ queryKey: ['guests'] });
      setMergeResult(`Merged ${result.mergedCount + 1} guest records.`);
      toast({ title: `Merged ${result.mergedCount + 1} guest records`, variant: 'success' });
      setMergingKey(null);
    },
    onError: (err: Error) => {
      toast({ title: `Merge failed: ${err.message}`, variant: 'destructive' });
      setMergingKey(null);
    },
  });

  const handleDismiss = useCallback(
    (key: string) => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(key);
        saveDismissed(next);
        return next;
      });
    },
    [],
  );

  const handleMerge = useCallback(
    (clusterKey: string, primaryId: string, duplicateIds: string[]) => {
      if (!primaryId || duplicateIds.length === 0) {
        toast({ title: 'Select a primary record first', variant: 'destructive' });
        return;
      }
      setMergingKey(clusterKey);
      mergeMutation.mutate({ primaryId, duplicateIds });
    },
    [mergeMutation, toast],
  );

  if (!canViewGuests) return null;

  const visibleClusters = (data?.clusters ?? []).filter((c: any) => !dismissed.has(c.key));
  const highCount = visibleClusters.filter((c: any) => c.confidence === 'high').length;
  const medCount = visibleClusters.filter((c: any) => c.confidence === 'medium').length;

  return (
    <aside
      className="w-full lg:w-80 xl:w-96 flex flex-col gap-4 flex-shrink-0"
      aria-label="Guest merge suggestions panel"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Merge className="h-4 w-4 text-brand" aria-hidden="true" />
            Merge Suggestions
          </h2>
          {!isLoading && visibleClusters.length > 0 && (
            <p className="text-xs text-fg-subtle mt-0.5">
              {highCount > 0 && `${highCount} high confidence`}
              {highCount > 0 && medCount > 0 && ', '}
              {medCount > 0 && `${medCount} medium confidence`}
            </p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="Close merge panel"
          >
            <X className="h-4 w-4 text-fg-muted" />
          </button>
        )}
      </div>

      {/* Merge success feedback */}
      {mergeResult && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg bg-success/10 border border-success/30 p-3 text-xs text-success"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          {mergeResult}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3" aria-label="Loading suggestions" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && visibleClusters.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-fg">All guests look unique</p>
          <p className="text-xs text-fg-muted mt-1">
            No duplicate clusters detected across your events.
          </p>
        </div>
      )}

      {/* Cluster list — high confidence first */}
      {!isLoading && visibleClusters.length > 0 && (
        <div className="space-y-3 overflow-y-auto">
          {/* High confidence first */}
          {visibleClusters
            .sort((a: any, b: any) => (a.confidence === 'high' ? -1 : 1))
            .map((cluster: any) => (
              <ClusterCard
                key={cluster.key}
                cluster={cluster}
                      canManage={canManageGuests}
                onMerge={(primaryId, duplicateIds) =>
                  handleMerge(cluster.key, primaryId, duplicateIds)
                }
                onDismiss={handleDismiss}
                merging={mergingKey === cluster.key}
              />
            ))}
        </div>
      )}
    </aside>
  );
}
