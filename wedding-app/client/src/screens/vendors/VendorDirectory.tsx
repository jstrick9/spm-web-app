/**
 * VendorDirectory — Cross-event vendor directory at /vendors.
 * 
 * Shows all vendors across the org with search, category filter,
 * preferred-vendor highlighting, and financial overview.
 */
import { useQuery } from '@tanstack/react-query';
import {
  Building2, DollarSign, Mail, Phone, Globe, Search,
  Star, Users, ExternalLink,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { sdk } from '../../sdk';
import type { SdkVendor } from '../../sdk/types';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Skeleton } from '../../ui/Skeleton';
import { StatCard } from '../../ui/StatCard';
import { ReliabilityBadge } from './ReliabilityBadge';
import { useDebouncedValue } from '../../lib/useDebouncedValue';

interface Props { orgId: string }

const CATEGORY_COLORS: Record<string, string> = {
  Catering: 'bg-chart-1/15 text-chart-1',
  Photography: 'bg-chart-2/15 text-chart-2',
  Florist: 'bg-chart-3/15 text-chart-3',
  'DJ / Music': 'bg-chart-4/15 text-chart-4',
  Venue: 'bg-chart-5/15 text-chart-5',
  Rentals: 'bg-chart-6/15 text-chart-6',
  Videography: 'bg-chart-7/15 text-chart-7',
  other: 'bg-surface-2 text-fg-muted',
};

export function VendorDirectory({ orgId }: Props) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const vendorsQuery = useQuery({
    queryKey: ['vendors', orgId],
    queryFn: () => sdk.vendors.list(orgId),
  });

  const scoresQuery = useQuery({
    queryKey: ['vendor-scores', orgId],
    queryFn: () => sdk.vendorScoring.scores(orgId),
    staleTime: 60_000,
  });
  const scoreByVendor = useMemo(() => {
    const m = new Map<string, { tier: import('../../sdk/intelligence').VendorTier; reliabilityScore: number }>();
    for (const s of scoresQuery.data?.scores ?? []) m.set(s.vendorId, { tier: s.tier, reliabilityScore: s.reliabilityScore });
    return m;
  }, [scoresQuery.data]);

  const vendors = vendorsQuery.data?.vendors ?? [];

  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const v of vendors) {
      const c = v.category || 'other';
      cats.set(c, (cats.get(c) ?? 0) + 1);
    }
    return Array.from(cats.entries()).sort((a, b) => b[1] - a[1]);
  }, [vendors]);

  const filtered = useMemo(() => {
    let list = vendors;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(v =>
        v.name.toLowerCase().includes(q) ||
        (v.contact_name ?? '').toLowerCase().includes(q) ||
        (v.category ?? '').toLowerCase().includes(q) ||
        (v.email ?? '').toLowerCase().includes(q)
      );
    }
    if (catFilter) {
      list = list.filter(v => (v.category || 'other') === catFilter);
    }
    return list;
  }, [vendors, debouncedSearch, catFilter]);

  // Financial KPIs
  const totalContracted = vendors.reduce((s, v) => s + (v.contract_amount_cents ?? 0), 0);
  const totalPaid = vendors.reduce((s, v) => s + v.amount_paid_cents, 0);
  const outstanding = totalContracted - totalPaid;
  const preferredCount = vendors.filter(v => v.is_preferred).length;

  return (
    <>
      <PageHeader
        title="Vendor Directory"
        description="All vendors across your organization's events."
      />
      <PageBody className="space-y-5">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Vendors" value={vendors.length} />
          <StatCard
            label="Contracted"
            value={`$${(totalContracted / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <StatCard
            label="Paid"
            value={`$${(totalPaid / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          />
          <StatCard
            label="Outstanding"
            value={`$${(outstanding / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            description={outstanding > 0 ? `${preferredCount} preferred vendors` : undefined}
          />
        </div>

        {/* Search + category filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" />
            <Input
              placeholder="Search vendors…"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCatFilter(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer
                ${!catFilter ? 'bg-brand text-on-brand' : 'bg-surface-2 text-fg-muted hover:bg-surface-2/80'}`}
            >
              All ({vendors.length})
            </button>
            {categories.map(([cat, count]) => (
              <button
                key={cat}
                onClick={() => setCatFilter(catFilter === cat ? null : cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer
                  ${catFilter === cat ? 'bg-brand text-on-brand' : 'bg-surface-2 text-fg-muted hover:bg-surface-2/80'}`}
              >
                {cat} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Vendor cards grid */}
        {vendorsQuery.isLoading ? (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="h-10 w-10 mx-auto text-fg-subtle mb-3" />
              <p className="text-fg-muted text-sm">
                {search || catFilter ? 'No vendors match your filters.' : 'No vendors yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(v => <VendorCard key={v.id} vendor={v} score={scoreByVendor.get(v.id)} />)}
          </div>
        )}
      </PageBody>
    </>
  );
}

function VendorCard({ vendor: v, score }: { vendor: SdkVendor; score?: { tier: import('../../sdk/intelligence').VendorTier; reliabilityScore: number } }) {
  const catColor = CATEGORY_COLORS[v.category] ?? CATEGORY_COLORS.other;
  const balance = (v.contract_amount_cents ?? 0) - v.amount_paid_cents;
  const paidPct = (v.contract_amount_cents ?? 0) > 0
    ? Math.round((v.amount_paid_cents / (v.contract_amount_cents ?? 1)) * 100)
    : 0;

  return (
    <Card className="hover:shadow-elev-2 transition-shadow">
      <CardContent className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-fg">{v.name}</h3>
              {v.is_preferred === 1 && (
                <Star className="h-3.5 w-3.5 text-warning fill-warning" />
              )}
            </div>
            {v.contact_name && (
              <p className="text-xs text-fg-muted mt-0.5">{v.contact_name}</p>
            )}
            {score && score.tier !== 'unrated' && (
              <div className="mt-1.5"><ReliabilityBadge tier={score.tier} score={score.reliabilityScore} /></div>
            )}
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${catColor}`}>
            {v.category}
          </span>
        </div>

        {/* Contact links */}
        <div className="flex items-center gap-3 text-xs text-fg-muted">
          {v.email && (
            <a href={`mailto:${v.email}`} className="flex items-center gap-1 hover:text-brand" title={v.email}>
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{v.email}</span>
            </a>
          )}
          {v.phone && (
            <a href={`tel:${v.phone}`} className="flex items-center gap-1 hover:text-brand">
              <Phone className="h-3 w-3" /> {v.phone}
            </a>
          )}
          {v.website_url && (
            <a href={v.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-brand">
              <Globe className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Financial bar */}
        {(v.contract_amount_cents ?? 0) > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-fg-muted">
                ${(v.amount_paid_cents / 100).toLocaleString()} paid
              </span>
              <span className="font-medium">
                ${((v.contract_amount_cents ?? 0) / 100).toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${paidPct >= 100 ? 'bg-success' : 'bg-brand'}`}
                style={{ width: `${Math.min(paidPct, 100)}%` }}
              />
            </div>
            {balance > 0 && (
              <p className="text-[11px] text-fg-subtle">
                ${(balance / 100).toLocaleString()} remaining
              </p>
            )}
          </div>
        )}

        {/* Event link */}
        {v.event_id && (
          <a href={`#/events/${v.event_id}?tab=vendors`} className="text-xs text-brand hover:underline inline-flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> View in event
          </a>
        )}
      </CardContent>
    </Card>
  );
}
