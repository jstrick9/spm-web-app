/**
 * VendorMatchPanel — smart vendor matching for an event.
 *
 * Ranks the org's vendors by FIT for THIS event (reliability score + budget
 * band + optional category filter) and explains each recommendation. Reads
 * GET /api/events/:id/vendor-matches.
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Filter } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { VendorMatch } from '../../../sdk/intelligence';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { ReliabilityBadge } from '../../vendors/ReliabilityBadge';

interface Props { eventId: string }

const money = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;

const BUDGET_FIT_BADGE: Record<VendorMatch['budgetFit'], { label: string; variant: 'success' | 'warning' | 'default' } | null> = {
  within: { label: 'In budget', variant: 'success' },
  under: { label: 'Budget-friendly', variant: 'success' },
  over: { label: 'Over budget', variant: 'warning' },
  unknown: null,
};

export function VendorMatchPanel({ eventId }: Props) {
  const [category, setCategory] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-matches', eventId, category],
    queryFn: () => sdk.vendorScoring.matches(eventId, { category: category || undefined, limit: 8 }),
    staleTime: 60_000,
  });
  const matches = data?.matches ?? [];

  // Build the category filter from whatever the matcher returned (unfiltered).
  const { data: allData } = useQuery({
    queryKey: ['vendor-matches', eventId, ''],
    queryFn: () => sdk.vendorScoring.matches(eventId, { limit: 50 }),
    staleTime: 60_000,
  });
  const categories = useMemo(() => {
    const set = new Set((allData?.matches ?? []).map(m => m.category).filter(Boolean));
    return Array.from(set).sort();
  }, [allData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" /> Recommended Vendors
            </CardTitle>
            <CardDescription>Ranked by reliability and fit for this event's budget</CardDescription>
          </div>
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter className="h-3.5 w-3.5 text-fg-subtle" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter recommendations by category"
                className="h-8 px-2 rounded-md border border-border bg-surface text-xs"
              >
                <option value="">All categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-fg-muted py-6 text-center">Analyzing vendors…</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-fg-muted py-6 text-center border border-dashed border-border rounded-md">
            No vendors to recommend yet. Add vendors and rate them after events to build reliability scores.
          </p>
        ) : (
          <ol className="space-y-3">
            {matches.map((m, i) => {
              const fitBadge = BUDGET_FIT_BADGE[m.budgetFit];
              return (
                <li key={m.vendorId} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-surface-2/40 transition-colors">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-brand-soft text-brand-strong text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-xs text-fg-subtle capitalize">{m.category}</span>
                      <ReliabilityBadge tier={m.tier} score={m.reliabilityScore} />
                      {fitBadge && <Badge variant={fitBadge.variant} className="text-[10px]">{fitBadge.label}</Badge>}
                    </div>
                    <p className="text-xs text-fg-muted mt-1">
                      {m.matchReasons.join(' · ')}
                      {m.typicalContractCents != null && ` · ~${money(m.typicalContractCents)} typical`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold tabular-nums text-brand-strong">{m.fitScore}</div>
                    <div className="text-[10px] text-fg-subtle uppercase tracking-wide">fit</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
