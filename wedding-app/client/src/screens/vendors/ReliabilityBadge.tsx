/**
 * ReliabilityBadge — compact tier + reliability-score chip for a vendor.
 * Shared by the Vendor Directory and the per-event match panel.
 */
import React from 'react';
import { ShieldCheck, Shield, Sparkles, HelpCircle } from 'lucide-react';
import type { VendorTier } from '../../sdk/intelligence';
import { Badge } from '../../ui/Badge';

const TIER_META: Record<VendorTier, { label: string; variant: 'success' | 'brand' | 'info' | 'default'; Icon: typeof Shield }> = {
  top_rated:  { label: 'Top Rated', variant: 'success', Icon: ShieldCheck },
  trusted:    { label: 'Trusted',   variant: 'brand',   Icon: Shield },
  promising:  { label: 'Promising', variant: 'info',    Icon: Sparkles },
  unrated:    { label: 'Unrated',   variant: 'default', Icon: HelpCircle },
};

export function ReliabilityBadge({ tier, score, showScore = true }: {
  tier: VendorTier;
  score: number;
  showScore?: boolean;
}) {
  const meta = TIER_META[tier] ?? TIER_META.unrated;
  const Icon = meta.Icon;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={meta.variant} className="text-[10px] inline-flex items-center gap-1">
        <Icon className="h-3 w-3" /> {meta.label}
      </Badge>
      {showScore && tier !== 'unrated' && (
        <span className="text-xs tabular-nums text-fg-muted" title="Reliability score (0–100)">{score}</span>
      )}
    </span>
  );
}
