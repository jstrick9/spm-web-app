import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, MessageSquare, Award, Star } from 'lucide-react';
import { sdk } from '../../sdk';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';

interface Props {
  orgId: string;
}

export function NpsSurveyCard({ orgId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['nps-stats', orgId],
    queryFn: () => sdk.feedback.getNpsStats(orgId),
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  const { npsScore, totalResponses, promoters, detractors, responses = [] } = data ?? {
    npsScore: null,
    totalResponses: 0,
    promoters: 0,
    detractors: 0,
    responses: [],
  };

  const passives = totalResponses - promoters - detractors;

  const getScoreColorClass = (score: number | null) => {
    if (score === null) return 'text-fg-subtle';
    if (score >= 70) return 'text-success';
    if (score >= 30) return 'text-brand';
    return 'text-danger';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 9) return 'success';
    if (score >= 7) return 'info';
    return 'destructive';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-brand" aria-hidden="true" />
          Post-Event NPS & Couple Feedback
        </CardTitle>
        <CardDescription>Automated feedback metrics captured from completed events</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {totalResponses === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-10 w-10 text-fg-subtle mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-fg">No feedback received yet</p>
            <p className="text-xs text-fg-muted mt-1">
              Feedback triggers automatically when events are completed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* NPS score gauge */}
            <div className="flex flex-col items-center justify-center text-center p-4 border border-border rounded-xl bg-surface-2/40">
              <span className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wider">
                Net Promoter Score
              </span>
              <span className={['text-6xl font-serif font-black my-2', getScoreColorClass(npsScore)].join(' ')}>
                {npsScore !== null ? (npsScore > 0 ? `+${npsScore}` : npsScore) : '—'}
              </span>
              <Badge variant={npsScore !== null && npsScore >= 50 ? 'success' : 'default'} className="text-[10px]">
                {npsScore !== null && npsScore >= 70 ? 'Excellent' : npsScore !== null && npsScore >= 30 ? 'Good' : 'Needs Focus'}
              </Badge>
              <span className="text-[11px] text-fg-subtle mt-3">
                Based on {totalResponses} respondent{totalResponses !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Distribution metrics */}
            <div className="space-y-4 flex flex-col justify-center">
              <h4 className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Score Distribution</h4>
              <div className="space-y-2">
                {/* Promoters */}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-success flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" /> Promoters (9-10)
                    </span>
                    <span className="text-fg tabular-nums font-bold">
                      {promoters} ({totalResponses > 0 ? Math.round((promoters / totalResponses) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${totalResponses > 0 ? (promoters / totalResponses) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* Passives */}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-info flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-info" /> Passives (7-8)
                    </span>
                    <span className="text-fg tabular-nums font-bold">
                      {passives} ({totalResponses > 0 ? Math.round((passives / totalResponses) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-info rounded-full" style={{ width: `${totalResponses > 0 ? (passives / totalResponses) * 100 : 0}%` }} />
                  </div>
                </div>

                {/* Detractors */}
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-danger flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-danger" /> Detractors (0-6)
                    </span>
                    <span className="text-fg tabular-nums font-bold">
                      {detractors} ({totalResponses > 0 ? Math.round((detractors / totalResponses) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-danger rounded-full" style={{ width: `${totalResponses > 0 ? (detractors / totalResponses) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Recent couple comments */}
            <div className="space-y-3 md:border-l md:border-border md:pl-6">
              <h4 className="text-xs font-bold text-fg-subtle uppercase tracking-wider">Recent Couple Comments</h4>
              <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                {responses.slice(0, 3).map((r) => (
                  <div key={r.id} className="text-xs border-b border-border/60 pb-2 last:border-0 last:pb-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-fg truncate">{r.submittedBy}</span>
                      <Badge variant={getScoreBadgeVariant(r.score) as any} className="text-[9px] px-1.5 py-0.5">
                        Score {r.score}
                      </Badge>
                    </div>
                    <p className="text-fg-muted italic line-clamp-2">"{r.comment || 'No comment left'}"</p>
                    <div className="text-[10px] text-fg-subtle">
                      {r.eventTitle} · {new Date(r.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
