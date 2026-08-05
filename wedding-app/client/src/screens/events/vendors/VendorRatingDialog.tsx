/**
 * VendorRatingDialog — rate a vendor for this event and see their
 * aggregate performance across all events.
 *
 * This wires the long-existing server ratings endpoints
 * (POST/GET /api/vendors/:id/ratings) into the UI. The server upserts
 * per (vendor, event) — re-rating this vendor for this event updates the
 * previous score rather than stacking duplicates.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, StarHalf, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/Dialog';
import { Button } from '../../../ui/Button';
import { useToast } from '../../../ui/Toast';
import { sdk } from '../../../sdk';
import type { SdkVendor } from '../../../sdk/types';
import type { SdkVendorRating } from '../../../sdk/intelligence';
import { cn } from '../../../ui/lib/cn';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  vendor: SdkVendor;
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Poor', 2: 'Below average', 3: 'Met expectations', 4: 'Exceeded', 5: 'Outstanding',
};

function Stars({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(cls, i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-fg-subtle')}
          aria-hidden
        />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${label}: ${i} out of 5 stars (${SCORE_LABELS[i]})`}
          onClick={() => onChange(i)}
          className={cn('p-0.5 rounded transition-transform hover:scale-110 cursor-pointer', value >= i ? 'text-amber-400' : 'text-fg-subtle hover:text-amber-300')}
        >
          <Star className={cn('h-6 w-6', value >= i && 'fill-amber-400')} aria-hidden />
        </button>
      ))}
      {value > 0 && <span className="ml-2 text-xs text-fg-muted">{SCORE_LABELS[value]}</span>}
    </div>
  );
}

function ScoreSelect({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
      {label}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer"
      >
        <option value="">Not rated</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>{n} — {SCORE_LABELS[n]}</option>
        ))}
      </select>
    </label>
  );
}

export function VendorRatingDialog({ open, onOpenChange, eventId, vendor }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [quality, setQuality] = useState<number | null>(null);
  const [timeliness, setTimeliness] = useState<number | null>(null);
  const [communication, setCommunication] = useState<number | null>(null);
  const [review, setReview] = useState('');

  const ratingsQuery = useQuery({
    queryKey: ['vendor-ratings', vendor.id],
    queryFn: () => sdk.intelligence.vendorRatings.list(vendor.id),
    enabled: open,
  });

  const existingForEvent = ratingsQuery.data?.ratings.find((r) => r.event_id === eventId);

  // Pre-fill the form from the existing (event, vendor) rating when opened.
  useEffect(() => {
    if (open) {
      setRating(existingForEvent?.rating ?? 0);
      setQuality(existingForEvent?.quality_score ?? null);
      setTimeliness(existingForEvent?.timeliness_score ?? null);
      setCommunication(existingForEvent?.communication_score ?? null);
      setReview(existingForEvent?.review ?? '');
    }
  }, [open, existingForEvent]);

  const saveMutation = useMutation({
    mutationFn: () =>
      sdk.intelligence.vendorRatings.create(vendor.id, {
        eventId,
        rating,
        qualityScore: quality ?? undefined,
        timelinessScore: timeliness ?? undefined,
        communicationScore: communication ?? undefined,
        review: review.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-ratings', vendor.id] });
      toast({ title: 'Vendor rating saved', description: `${vendor.name} has been rated ${rating}/5 for this event.`, variant: 'success' });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Could not save rating', description: err.message, variant: 'destructive' });
    },
  });

  const aggregate = ratingsQuery.data?.aggregate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" aria-hidden />
            Rate {vendor.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {aggregate && aggregate.count > 0 && (
            <div className="rounded-lg border border-border bg-surface-2/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Stars value={aggregate.avgRating} size="sm" />
                  <span className="text-sm font-bold tabular-nums">{aggregate.avgRating.toFixed(1)}</span>
                  <span className="text-xs text-fg-muted">across {aggregate.count} event{aggregate.count === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-fg-muted">
                <span>Quality: <strong className="text-fg tabular-nums">{aggregate.avgQuality ? aggregate.avgQuality.toFixed(1) : '—'}</strong></span>
                <span>Timeliness: <strong className="text-fg tabular-nums">{aggregate.avgTimeliness ? aggregate.avgTimeliness.toFixed(1) : '—'}</strong></span>
                <span>Communication: <strong className="text-fg tabular-nums">{aggregate.avgCommunication ? aggregate.avgCommunication.toFixed(1) : '—'}</strong></span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-fg">Overall rating for this event</p>
            <StarPicker value={rating} onChange={setRating} label="Overall rating" />
            {existingForEvent && (
              <p className="text-[11px] text-fg-muted">
                You rated this vendor {existingForEvent.rating}/5 for this event — saving again updates it.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <ScoreSelect label="Quality" value={quality} onChange={setQuality} />
            <ScoreSelect label="Timeliness" value={timeliness} onChange={setTimeliness} />
            <ScoreSelect label="Communication" value={communication} onChange={setCommunication} />
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
            Review (optional)
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What went well? What should improve for next time?"
              className="rounded-md border border-border bg-surface p-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-brand/40 resize-y"
            />
          </label>

          {ratingsQuery.data && ratingsQuery.data.ratings.length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg">
                <History className="h-3.5 w-3.5 text-fg-muted" aria-hidden /> Past reviews
              </p>
              <ul className="space-y-2 max-h-28 overflow-y-auto pr-1">
                {ratingsQuery.data.ratings.map((r: SdkVendorRating) => (
                  <li key={r.id} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Stars value={r.rating} size="sm" />
                      <span className="text-fg-subtle">{new Date(r.created_at).toLocaleDateString()}</span>
                    </span>
                    {r.review && <p className="mt-0.5 text-fg-muted line-clamp-2">{r.review}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={rating === 0 || saveMutation.isPending}
            isLoading={saveMutation.isPending}
          >
            <Star className="h-3.5 w-3.5 mr-1 fill-current" aria-hidden />
            {existingForEvent ? 'Update rating' : 'Save rating'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
