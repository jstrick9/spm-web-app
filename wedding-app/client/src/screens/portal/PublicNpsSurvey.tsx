import React, { useState, useEffect } from 'react';
import { sdk } from '../../sdk';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Label } from '../../ui/Label';
import { Input } from '../../ui/Input';
import { Heart, Send, Sparkles } from 'lucide-react';

export function PublicNpsSurvey({ eventId }: { eventId: string }) {
  const [eventTitle, setEventTitle] = useState('Your Wedding Experience');
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submittedBy, setSubmittedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sdk.portal.info(eventId)
      .then((r) => {
        if (r?.event?.title) {
          setEventTitle(r.event.title);
        }
      })
      .catch(() => {
        // Fall back gracefully
      });
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score === null) {
      setError('Please select a score from 0 to 10.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await sdk.feedback.submitNps(eventId, {
        score,
        comment,
        submittedBy: submittedBy || undefined,
      });
      setDone(true);
    } catch (err: any) {
      if (err?.code === 'already-submitted') {
        // One response per device (server-enforced) — treat as success for
        // the guest's experience.
        setDone(true);
      } else {
        setError(err?.message || 'Could not submit feedback.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-bg-soft flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-lg border-brand-soft">
          <CardContent className="pt-12 pb-10 space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 bg-success-soft rounded-full flex items-center justify-center text-success">
                <Heart className="h-8 w-8 fill-success" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold text-fg">Thank You!</h2>
              <p className="text-sm text-fg-muted">
                Your feedback has been joyfully received. We appreciate your partnership in making every wedding at {eventTitle} exceptional.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-soft flex items-center justify-center p-4">
      <Card className="max-w-xl w-full shadow-lg border-border">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto h-12 w-12 bg-brand-soft rounded-full flex items-center justify-center text-brand mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="font-serif text-3xl font-bold">Post-Event Feedback</CardTitle>
          <CardDescription className="text-sm text-fg-muted mt-2">
            Share your experience celebrating <strong className="text-fg">{eventTitle}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* NPS Score Selector */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-fg">
                How likely are you to recommend our venue to a friend or colleague?
              </Label>
              <div className="flex items-center justify-between gap-1 sm:gap-2">
                {[...Array(11).keys()].map((val) => {
                  const isSelected = score === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setScore(val)}
                      className={[
                        'flex-1 h-10 rounded-lg text-xs font-semibold border transition-all duration-150',
                        isSelected
                          ? 'bg-brand text-brand-fg border-brand scale-110 shadow-md'
                          : 'bg-surface border-border text-fg-muted hover:border-brand-soft hover:bg-brand-soft/20',
                      ].join(' ')}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[11px] text-fg-subtle px-1">
                <span>0 - Extremely Unlikely</span>
                <span>10 - Extremely Likely</span>
              </div>
            </div>

            {/* Comment Area */}
            <div className="space-y-1.5">
              <Label htmlFor="comments">What did you love most, or what could we improve?</Label>
              <textarea
                id="comments"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full min-h-[120px] p-3 rounded-lg border border-border bg-surface text-sm focus:ring-2 focus:ring-brand focus:outline-none resize-none mt-1"
                placeholder="Share your thoughts about our service, coordination, and venue quality..."
              />
            </div>

            {/* Submitted By */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Your Name (Optional)</Label>
              <Input
                id="name"
                type="text"
                value={submittedBy}
                onChange={(e) => setSubmittedBy(e.target.value)}
                placeholder="Jane & John"
                className="mt-1"
              />
            </div>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              isLoading={submitting}
              disabled={score === null || submitting}
              className="w-full h-11 tracking-wider font-semibold"
            >
              <Send className="h-4 w-4 mr-2" />
              SUBMIT FEEDBACK
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
