/**
 * GuestMergePanel — surfaces cross-event duplicate guest clusters and lets
 * staff merge true duplicates into a primary record. Merges are human-confirmed
 * (you pick the primary); the server backfills contact fields and soft-deletes
 * the rest. Clusters that span different events are also useful as a
 * "repeat guest" signal even when not merged.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users2, GitMerge, Mail, Phone, ChevronDown, ChevronRight } from 'lucide-react';
import { sdk } from '../../sdk';
import type { GuestDuplicateCluster } from '../../sdk/guests';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';
import { usePermission } from '../../lib/usePermission';

interface Props { orgId: string }

const SIGNAL_LABEL: Record<string, string> = { email: 'same email', phone: 'same phone', name: 'same name' };

export function GuestMergePanel({ orgId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = usePermission('guests.manage');
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['guest-duplicates', orgId],
    queryFn: () => sdk.guests.duplicates(orgId),
    staleTime: 60_000,
  });
  const clusters = data?.clusters ?? [];

  if (clusters.length === 0) return null; // nothing to show — keep the page clean

  return (
    <Card className="border-warning/30">
      <CardHeader>
        <button
          className="w-full flex items-center justify-between text-left"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users2 className="h-4 w-4 text-warning" /> Possible Duplicate Guests
              <Badge variant="warning" className="text-[10px]">{clusters.length}</Badge>
            </CardTitle>
            <CardDescription>Same person across or within events — review and merge true duplicates</CardDescription>
          </div>
          {open ? <ChevronDown className="h-4 w-4 text-fg-muted" /> : <ChevronRight className="h-4 w-4 text-fg-muted" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {clusters.map(c => (
            <ClusterRow key={c.key} cluster={c} orgId={orgId} canManage={canManage}
              onMerged={() => {
                qc.invalidateQueries({ queryKey: ['guest-duplicates', orgId] });
                qc.invalidateQueries({ queryKey: ['org-guests', orgId] });
                qc.invalidateQueries({ queryKey: ['guests'] });
                toast({ title: 'Guests merged', variant: 'success' });
              }}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function ClusterRow({ cluster: c, orgId, canManage, onMerged }: {
  cluster: GuestDuplicateCluster;
  orgId: string;
  canManage: boolean;
  onMerged: () => void;
}) {
  // Default primary = earliest-created member (most likely the original).
  const [primaryId, setPrimaryId] = useState(c.members[0]?.id ?? '');

  const mergeMutation = useMutation({
    mutationFn: () => sdk.guests.merge(orgId, primaryId, c.members.filter(m => m.id !== primaryId).map(m => m.id)),
    onSuccess: onMerged,
  });

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="font-medium">{c.members[0].fullName}</span>
        <Badge variant={c.confidence === 'high' ? 'success' : 'warning'} className="text-[10px] capitalize">{c.confidence}</Badge>
        <span className="text-xs text-fg-muted">{c.signals.map(s => SIGNAL_LABEL[s] ?? s).join(', ')}</span>
        {c.hasInEventDuplicate && <Badge variant="danger" className="text-[10px]">In-event duplicate</Badge>}
      </div>

      <ul className="space-y-1.5 mb-3">
        {c.members.map(m => (
          <li key={m.id} className="flex items-center gap-2 text-sm">
            {canManage && (
              <input
                type="radio"
                name={`primary-${c.key}`}
                checked={primaryId === m.id}
                onChange={() => setPrimaryId(m.id)}
                aria-label={`Keep ${m.fullName} from ${m.eventTitle} as primary`}
                className="accent-brand"
              />
            )}
            <span className="text-fg-muted text-xs w-40 truncate" title={m.eventTitle}>{m.eventTitle}</span>
            <span className="flex-1 truncate">{m.fullName}</span>
            {m.email && <span className="text-xs text-fg-subtle inline-flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</span>}
            {m.phone && <span className="text-xs text-fg-subtle inline-flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
            <Badge variant="outline" className="text-[10px] capitalize">{m.rsvpStatus}</Badge>
          </li>
        ))}
      </ul>

      {canManage ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="outline"
            onClick={() => {
              if (window.confirm(`Merge ${c.members.length - 1} duplicate(s) into the selected primary? This soft-deletes the others.`)) {
                mergeMutation.mutate();
              }
            }}
            disabled={mergeMutation.isPending}
            isLoading={mergeMutation.isPending}
          >
            <GitMerge className="h-3.5 w-3.5 mr-1.5" /> Merge into selected
          </Button>
          <span className="text-[11px] text-fg-subtle">Keeps the selected record; backfills its missing contact info.</span>
        </div>
      ) : (
        <p className="text-[11px] text-fg-subtle">You need the guests.manage permission to merge.</p>
      )}
    </div>
  );
}
