import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../sdk';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { useToast } from '../../../ui/Toast';
import { Skeleton } from '../../../ui/Skeleton';
import { MessageSquare, Star, BarChart, Plus, Check } from 'lucide-react';
import { cn } from '../../../ui/lib/cn';

interface Props {
  eventId: string;
}

export function EventFeedbackTab({ eventId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);

  const { data: pollsData, isLoading: pollsLoading } = useQuery({
    queryKey: ['polls', eventId],
    queryFn: () => sdk.feedback.getPolls(eventId),
  });

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ['feedback', eventId],
    queryFn: () => sdk.feedback.getFeedback(eventId),
  });

  const createPoll = useMutation({
    mutationFn: async () => {
      const validOptions = newPollOptions.filter(o => o.trim()).map((o, i) => ({ id: `opt-${i}`, text: o, votes: 0 }));
      if (!newPollQuestion.trim() || validOptions.length < 2) throw new Error('Requires question and at least 2 options.');
      return sdk.feedback.createPoll(eventId, { question: newPollQuestion, options: validOptions, status: 'active' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['polls', eventId] });
      setNewPollQuestion('');
      setNewPollOptions(['', '']);
      toast({ title: 'Poll Created', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' })
  });

  // Render Stars
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={cn("w-4 h-4", i < rating ? "text-amber-400 fill-amber-400" : "text-border")} />
    ));
  };

  if (pollsLoading || feedbackLoading) {
    return <div className="space-y-4">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-48 w-full" />)}</div>;
  }

  const polls = pollsData?.polls || [];
  const feedback = feedbackData?.feedback || [];

  const avgRating = feedback.length > 0 
    ? (feedback.reduce((acc, f) => acc + f.rating, 0) / feedback.length).toFixed(1) 
    : '0.0';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Polls */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2"><BarChart className="w-4 h-4 text-brand" /> Active Polls</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              
              {/* Poll Builder */}
              <div className="bg-surface-2 p-4 rounded-lg border border-border">
                <h4 className="text-sm font-medium mb-3">Create New Poll</h4>
                <div className="space-y-3">
                  <Input placeholder="E.g., Which centerpiece design?" value={newPollQuestion} onChange={e => setNewPollQuestion(e.target.value)} />
                  {newPollOptions.map((opt, i) => (
                    <Input key={i} placeholder={`Option ${i+1}`} value={opt} onChange={e => {
                      const newOpts = [...newPollOptions];
                      newOpts[i] = e.target.value;
                      setNewPollOptions(newOpts);
                    }} />
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setNewPollOptions([...newPollOptions, ''])} className="w-full border-dashed"><Plus className="w-4 h-4 mr-1"/> Add Option</Button>
                  <Button onClick={() => createPoll.mutate()} disabled={createPoll.isPending} className="w-full">Publish Poll</Button>
                </div>
              </div>

              {/* Poll List */}
              <div className="space-y-4">
                {polls.map(poll => {
                  const totalVotes = poll.options.reduce((acc, o) => acc + o.votes, 0);
                  return (
                    <div key={poll.id} className="border border-border rounded-lg p-4 bg-surface">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium">{poll.question}</h4>
                        <Badge variant={poll.status === 'active' ? 'success' : 'outline'} className="text-[10px] uppercase">{poll.status}</Badge>
                      </div>
                      <div className="space-y-2">
                        {poll.options.map(opt => {
                          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                          return (
                            <div key={opt.id} className="relative h-8 rounded-md overflow-hidden bg-surface-2 flex items-center px-3 border border-border">
                               <div className="absolute top-0 left-0 bottom-0 bg-brand/20 transition-all duration-500" style={{ width: `${pct}%` }} />
                               <div className="relative z-10 flex justify-between w-full text-sm">
                                 <span>{opt.text}</span>
                                 <span className="font-medium text-fg-muted">{opt.votes} ({pct}%)</span>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 text-xs text-fg-subtle text-right">Total Votes: {totalVotes}</div>
                    </div>
                  );
                })}
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Right Column: Feedback */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="w-4 h-4 text-brand" /> Post-Event Feedback</CardTitle>
              <div className="flex items-center gap-1 font-bold text-lg">
                {avgRating} <Star className="w-5 h-5 text-amber-400 fill-amber-400 -mt-0.5" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {feedback.length === 0 ? (
                <div className="text-center py-12 text-fg-muted">
                  <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No feedback collected yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedback.map(f => (
                    <div key={f.id} className="border border-border rounded-lg p-4 bg-surface space-y-2 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm text-fg">{f.target}</span>
                        <div className="flex">{renderStars(f.rating)}</div>
                      </div>
                      {f.comments && <p className="text-sm text-fg-muted italic">"{f.comments}"</p>}
                      <div className="text-[10px] text-fg-subtle uppercase tracking-wider">Submitted by {f.submittedBy}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
