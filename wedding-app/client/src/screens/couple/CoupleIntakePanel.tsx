import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, CheckCircle2 } from 'lucide-react';
import { sdk } from '../../sdk';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { useToast } from '../../ui/Toast';

type Question = {
  id: string;
  question: string;
  group_name: string;
  answer_type: 'dropdown' | 'integer' | 'text' | 'date' | 'boolean' | 'multiselect';
  options: string; // JSON array
  required: number;
  sort_order?: number;
};

function parseOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.map((o) => String(o)) : [];
  } catch {
    return [];
  }
}

/**
 * Couple Intake & Questionnaire — the venue's "Couple Intake Forms" were a
 * dead end: the studio created questions and the answers API existed, but
 * no UI let couples ANSWER them. This panel lists the venue's questions
 * grouped, renders the right control per answer type (text/integer/date/
 * boolean/dropdown/multiselect), enforces required answers on save, and
 * lets the couple edit their answers any time.
 */
export function CoupleIntakePanel({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const questionsQuery = useQuery({
    queryKey: ['couple-intake-questions', eventId],
    queryFn: () => sdk.questions.listForEvent(eventId),
  });
  const answersQuery = useQuery({
    queryKey: ['couple-intake-answers', eventId],
    queryFn: () => sdk.questions.listAnswers(eventId),
  });

  const questions: Question[] = (questionsQuery.data as any)?.questions ?? [];
  const existingAnswers = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of ((answersQuery.data as any)?.answers ?? []) as Array<{ question_id: string; answer: string | null }>) {
      map.set(a.question_id, a.answer ?? '');
    }
    return map;
  }, [answersQuery.data]);

  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!questions.length) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const q of questions) {
        if (next[q.id] === undefined) next[q.id] = existingAnswers.get(q.id) ?? '';
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.map((q) => q.id).join(','), answersQuery.data]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Question[]>();
    for (const q of [...questions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
      const key = q.group_name || 'General';
      groups.set(key, [...(groups.get(key) || []), q]);
    }
    return Array.from(groups.entries());
  }, [questions]);

  const saveMutation = useMutation({
    mutationFn: async (groupQuestions: Question[]) => {
      for (const q of groupQuestions) {
        await sdk.questions.upsertAnswer(eventId, q.id, (draft[q.id] ?? '').trim());
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['couple-intake-answers', eventId] });
      toast({ title: 'Intake answers saved', description: 'The venue can now see your answers.', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Could not save answers', description: e?.message || 'Please try again.', variant: 'destructive' }),
  });

  const saveGroup = (groupQuestions: Question[]) => {
    const missing = groupQuestions.filter((q) => q.required === 1 && !(draft[q.id] ?? '').trim());
    if (missing.length) {
      toast({ title: 'Required answers missing', description: `Please answer: ${missing.map((q) => q.question).join(', ')}`, variant: 'destructive' });
      return;
    }
    saveMutation.mutate(groupQuestions);
  };

  const answered = (qid: string) => Boolean((existingAnswers.get(qid) ?? '').trim());

  const renderControl = (q: Question) => {
    const value = draft[q.id] ?? '';
    const set = (v: string) => setDraft((prev) => ({ ...prev, [q.id]: v }));
    switch (q.answer_type) {
      case 'integer':
        return <Input type="number" aria-label={q.question} value={value} onChange={(e) => set(e.target.value)} />;
      case 'date':
        return <Input type="date" aria-label={q.question} value={value} onChange={(e) => set(e.target.value)} />;
      case 'boolean':
        return (
          <select aria-label={q.question} className="h-10 w-full rounded-md border border-border bg-surface px-2 text-sm" value={value} onChange={(e) => set(e.target.value)}>
            <option value="">— Select —</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        );
      case 'dropdown': {
        const options = parseOptions(q.options);
        return (
          <select aria-label={q.question} className="h-10 w-full rounded-md border border-border bg-surface px-2 text-sm" value={value} onChange={(e) => set(e.target.value)}>
            <option value="">— Select —</option>
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      }
      case 'multiselect': {
        const options = parseOptions(q.options);
        const selected = value ? value.split(',').filter(Boolean) : [];
        const toggle = (o: string) => {
          const next = selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o];
          set(next.join(','));
        };
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-sm">
                <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} /> {o}
              </label>
            ))}
          </div>
        );
      }
      default:
        return <Input aria-label={q.question} value={value} onChange={(e) => set(e.target.value)} placeholder="Your answer" />;
    }
  };

  if (questionsQuery.isError) {
    return (
      <Card id="couple-intake-panel" className="border-brand/20">
        <CardContent className="pt-6 text-center text-sm text-fg-muted">
          Could not load intake questions.{' '}
          <button className="font-bold underline text-brand" onClick={() => void questionsQuery.refetch()}>Retry</button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="couple-intake-panel" className="border-brand/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-4 w-4 text-brand" /> Couple Intake & Questionnaire</CardTitle>
        <CardDescription>Answer the venue's planning questions so your wedding details are captured in one place. Answers are visible to the venue team.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {questionsQuery.isLoading ? (
          <p className="text-sm text-fg-muted">Loading intake questions…</p>
        ) : questions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-fg-muted">The venue has not shared any intake questions yet. Check back after your coordinator publishes a form.</p>
        ) : (
          grouped.map(([group, groupQuestions]) => (
            <div key={group} className="rounded-xl border border-border bg-surface-2/40 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-brand">{group}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-fg-muted">{groupQuestions.filter((q) => answered(q.id)).length}/{groupQuestions.length} answered</span>
                  <Button size="xs" isLoading={saveMutation.isPending} onClick={() => saveGroup(groupQuestions)}>Save group</Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {groupQuestions.map((q) => (
                  <div key={q.id} className="space-y-1">
                    <label className="flex items-start gap-1.5 text-sm font-semibold">
                      <span>{q.question}</span>
                      {q.required === 1 && <span className="text-danger">*</span>}
                      {answered(q.id) && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" aria-label="answered" />}
                    </label>
                    {renderControl(q)}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
