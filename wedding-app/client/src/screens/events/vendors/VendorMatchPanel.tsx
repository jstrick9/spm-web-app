/**
 * VendorMatchPanel — smart vendor matching for an event.
 *
 * Ranks the org's vendors by FIT for THIS event (reliability score + budget
 * band + optional category filter) and explains each recommendation. Reads
 * GET /api/events/:id/vendor-matches.
 *
 * Enhanced with Dynamic Smart Matching Category Rankings (custom weight controllers,
 * weighted composite reliability score breakdowns, and premium luxury displays).
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Filter, Sliders, ChevronDown, ChevronUp, Info, Activity } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { VendorMatch, VendorTier } from '../../../sdk/intelligence';
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

const norm = (v: number) => Math.max(0, Math.min(100, ((v - 1) / 4) * 100)); // 1–5 → 0–100

function tierFor(score: number, count: number): VendorTier {
  if (count === 0) return 'unrated';
  if (score >= 85) return 'top_rated';
  if (score >= 70) return 'trusted';
  return 'promising';
}

export function VendorMatchPanel({ eventId }: Props) {
  const [category, setCategory] = useState<string>('');
  const [showAdvancedWeights, setShowAdvancedWeights] = useState<boolean>(false);
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

  // Weight customization presets or custom sliders
  const [preset, setPreset] = useState<'balanced' | 'quality' | 'timeliness' | 'communication' | 'custom'>('balanced');
  const [wOverall, setWOverall] = useState<number>(40);
  const [wQuality, setWQuality] = useState<number>(25);
  const [wTimeliness, setWTimeliness] = useState<number>(20);
  const [wCommunication, setWCommunication] = useState<number>(15);

  const handlePresetChange = (selected: typeof preset) => {
    setPreset(selected);
    if (selected === 'balanced') {
      setWOverall(40); setWQuality(25); setWTimeliness(20); setWCommunication(15);
    } else if (selected === 'quality') {
      setWOverall(20); setWQuality(50); setWTimeliness(15); setWCommunication(15);
    } else if (selected === 'timeliness') {
      setWOverall(20); setWQuality(15); setWTimeliness(50); setWCommunication(15);
    } else if (selected === 'communication') {
      setWOverall(20); setWQuality(15); setWTimeliness(15); setWCommunication(50);
    }
  };

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

  // Recalculate reliability + fit scores dynamically in-browser based on selected weights
  const dynamicMatches = useMemo(() => {
    return matches.map((m) => {
      if (m.ratingCount === 0) {
        return m; // Keep unrated matches unchanged with base values
      }

      const overall = norm(m.avgRating);
      const q = m.avgQuality > 0 ? norm(m.avgQuality) : overall;
      const t = m.avgTimeliness > 0 ? norm(m.avgTimeliness) : overall;
      const c = m.avgCommunication > 0 ? norm(m.avgCommunication) : overall;

      const totalWeight = wOverall + wQuality + wTimeliness + wCommunication;
      const baseScore = totalWeight > 0
        ? (wOverall * overall + wQuality * q + wTimeliness * t + wCommunication * c) / totalWeight
        : overall;

      const confidence = Math.min(1, m.ratingCount / 5);
      const reliabilityScore = Math.round(baseScore * (0.6 + 0.4 * confidence));
      const tier = tierFor(reliabilityScore, m.ratingCount);

      // Recalculate dynamic fit score based on the new reliability score
      let fit = reliabilityScore;
      if (m.isPreferred) {
        fit += 8;
      }

      if (m.budgetFit === 'within') fit += 10;
      else if (m.budgetFit === 'under') fit += 4;
      else if (m.budgetFit === 'over') fit -= 12;

      const fitScore = Math.max(0, Math.round(fit));

      return {
        ...m,
        reliabilityScore,
        tier,
        fitScore,
      };
    }).sort((a, b) => b.fitScore - a.fitScore || b.reliabilityScore - a.reliabilityScore);
  }, [matches, wOverall, wQuality, wTimeliness, wCommunication]);

  return (
    <Card className="border border-border/80 shadow-md">
      <CardHeader className="pb-4 border-b border-border/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-serif font-bold text-fg flex items-center gap-2 tracking-tight">
              <Sparkles className="h-5 w-5 text-brand" /> Smart Vendor Matching
            </CardTitle>
            <CardDescription className="text-xs text-fg-subtle">
              Dynamically recommend preferred vendor matches with customizable scoring criteria
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
            {categories.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0 bg-surface px-2.5 py-1.5 rounded-lg border border-border">
                <Filter className="h-3.5 w-3.5 text-fg-subtle" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="Filter recommendations by category"
                  className="bg-transparent text-xs font-semibold text-fg outline-none border-none cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
            )}
            <button
              onClick={() => setShowAdvancedWeights(!showAdvancedWeights)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2/60 text-xs font-semibold transition-colors"
            >
              <Sliders className="h-3.5 w-3.5 text-brand" /> Criteria Weights
              {showAdvancedWeights ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Advanced Weights Section */}
      {showAdvancedWeights && (
        <div className="bg-surface-2/30 p-4 border-b border-border/40 text-xs transition-all duration-300">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <div>
                <span className="font-bold text-fg block sm:inline">Score priority preset: </span>
                <span className="text-fg-muted">Choose weightings to prioritize special planning needs.</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['balanced', 'quality', 'timeliness', 'communication', 'custom'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePresetChange(p)}
                    className={[
                      'px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-all border',
                      preset === p
                        ? 'bg-brand/10 border-brand/40 text-brand'
                        : 'bg-surface border-border hover:bg-surface-2 text-fg-subtle'
                    ].join(' ')}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Weights Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-semibold text-fg-subtle">Overall Rating</span>
                  <span className="tabular-nums font-bold text-brand">{wOverall}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={wOverall}
                  disabled={preset !== 'custom'}
                  onChange={(e) => {
                    setWOverall(parseInt(e.target.value));
                    setPreset('custom');
                  }}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-brand disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-semibold text-fg-subtle">Service Quality</span>
                  <span className="tabular-nums font-bold text-brand">{wQuality}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={wQuality}
                  disabled={preset !== 'custom'}
                  onChange={(e) => {
                    setWQuality(parseInt(e.target.value));
                    setPreset('custom');
                  }}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-brand disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-semibold text-fg-subtle">Timeliness / Punctuality</span>
                  <span className="tabular-nums font-bold text-brand">{wTimeliness}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={wTimeliness}
                  disabled={preset !== 'custom'}
                  onChange={(e) => {
                    setWTimeliness(parseInt(e.target.value));
                    setPreset('custom');
                  }}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-brand disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="font-semibold text-fg-subtle">Communication</span>
                  <span className="tabular-nums font-bold text-brand">{wCommunication}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={wCommunication}
                  disabled={preset !== 'custom'}
                  onChange={(e) => {
                    setWCommunication(parseInt(e.target.value));
                    setPreset('custom');
                  }}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-brand disabled:opacity-50"
                />
              </div>
            </div>
            
            <p className="text-[10px] text-fg-subtle flex items-center gap-1.5">
              <Info className="h-3 w-3 text-brand" />
              Formula uses Bayesian review-volume tempering and normalized criteria weights to rank partners.
            </p>
          </div>
        </div>
      )}

      <CardContent className="pt-6">
        {isLoading ? (
          <p className="text-sm text-fg-muted py-8 text-center animate-pulse">Analyzing vendor profiles and ratings…</p>
        ) : dynamicMatches.length === 0 ? (
          <p className="text-sm text-fg-muted py-8 text-center border border-dashed border-border rounded-md bg-[#fdfbf7]/40">
            No vendors to recommend yet. Add vendors and rate them after events to build reliability scores.
          </p>
        ) : (
          <ol className="space-y-3.5">
            {dynamicMatches.map((m, i) => {
              const fitBadge = BUDGET_FIT_BADGE[m.budgetFit];
              const isExpanded = expandedVendorId === m.vendorId;
              return (
                <li
                  key={m.vendorId}
                  className={[
                    'flex flex-col rounded-lg border transition-all duration-200 overflow-hidden',
                    isExpanded ? 'border-brand/40 bg-[#fdfbf7]/50 shadow-sm' : 'border-border hover:bg-surface-2/30'
                  ].join(' ')}
                >
                  <div 
                    onClick={() => setExpandedVendorId(isExpanded ? null : m.vendorId)}
                    className="flex items-start gap-3 p-3.5 cursor-pointer select-none"
                  >
                    <div className="shrink-0 w-6 h-6 rounded-full bg-brand-soft text-brand-strong text-xs font-bold flex items-center justify-center mt-0.5 shadow-sm">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-serif font-semibold text-fg tracking-tight text-sm sm:text-base">{m.name}</span>
                        <span className="text-xs text-fg-subtle capitalize px-2 py-0.5 rounded-full bg-surface-2/60 border border-border/30">{m.category}</span>
                        <ReliabilityBadge tier={m.tier} score={m.reliabilityScore} />
                        {fitBadge && <Badge variant={fitBadge.variant} className="text-[10px] font-semibold">{fitBadge.label}</Badge>}
                      </div>
                      <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                        {m.matchReasons.join(' · ')}
                        {m.typicalContractCents != null && ` · ~${money(m.typicalContractCents)} typical`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xl font-bold font-serif tabular-nums text-brand-strong">{m.fitScore}</div>
                        <div className="text-[10px] text-fg-subtle uppercase tracking-wider font-semibold">fit</div>
                      </div>
                      <div className="text-fg-subtle/40 pl-1">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Rating breakdown expandable sub-panel */}
                  {isExpanded && m.ratingCount > 0 && (
                    <div className="px-11 pb-4 pt-1 bg-[#fdfbf7]/30 border-t border-border/20 text-xs space-y-3">
                      <div className="flex items-center gap-2 text-fg-muted font-bold text-[11px] uppercase tracking-wider">
                        <Activity className="h-3 w-3 text-brand" /> Detailed Score Breakdown
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-fg-subtle">Overall Rating ({wOverall}%)</span>
                            <span className="font-bold text-fg tabular-nums">{m.avgRating ? `${m.avgRating} / 5` : '—'}</span>
                          </div>
                          <div className="h-1.5 w-full bg-border/40 rounded-full overflow-hidden">
                            <div className="h-full bg-brand rounded-full" style={{ width: `${(m.avgRating / 5) * 100}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-fg-subtle">Service Quality ({wQuality}%)</span>
                            <span className="font-bold text-fg tabular-nums">{m.avgQuality ? `${m.avgQuality} / 5` : '—'}</span>
                          </div>
                          <div className="h-1.5 w-full bg-border/40 rounded-full overflow-hidden">
                            <div className="h-full bg-brand rounded-full" style={{ width: `${((m.avgQuality || m.avgRating) / 5) * 100}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-fg-subtle">Timeliness / Punctuality ({wTimeliness}%)</span>
                            <span className="font-bold text-fg tabular-nums">{m.avgTimeliness ? `${m.avgTimeliness} / 5` : '—'}</span>
                          </div>
                          <div className="h-1.5 w-full bg-border/40 rounded-full overflow-hidden">
                            <div className="h-full bg-brand rounded-full" style={{ width: `${((m.avgTimeliness || m.avgRating) / 5) * 100}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-fg-subtle">Communication ({wCommunication}%)</span>
                            <span className="font-bold text-fg tabular-nums">{m.avgCommunication ? `${m.avgCommunication} / 5` : '—'}</span>
                          </div>
                          <div className="h-1.5 w-full bg-border/40 rounded-full overflow-hidden">
                            <div className="h-full bg-brand rounded-full" style={{ width: `${((m.avgCommunication || m.avgRating) / 5) * 100}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="pt-1.5 text-[10px] text-fg-subtle border-t border-border/20 flex justify-between items-center">
                        <span>Total reviews logged: <strong className="text-fg font-bold">{m.ratingCount}</strong></span>
                        {m.typicalContractCents != null && (
                          <span>Typical contract: <strong className="text-fg font-bold">{money(m.typicalContractCents)}</strong></span>
                        )}
                      </div>
                    </div>
                  )}

                  {isExpanded && m.ratingCount === 0 && (
                    <div className="px-11 pb-4 pt-2 bg-[#fdfbf7]/30 border-t border-border/20 text-xs">
                      <p className="text-fg-subtle italic">No ratings logged for this vendor yet. Ratings will automatically construct this vendor's composite quality card.</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
