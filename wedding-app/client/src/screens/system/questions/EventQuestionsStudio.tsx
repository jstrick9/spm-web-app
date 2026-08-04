import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ListTodo, Edit2, Trash2, GripVertical, Settings2, Sparkles } from 'lucide-react';
import { PageBody, PageHeader } from '../../../ui/AppShell';
import { Card, CardContent } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { cn } from '../../../ui/lib/cn';
import { sdk } from '../../../sdk';
import { useToast } from '../../../ui/Toast';
import { usePrompt } from '../../../ui/usePrompt';
import { Skeleton } from '../../../ui/Skeleton';
import { QuestionFormDialog } from './QuestionFormDialog';
import type { SdkEventQuestion } from '../../../sdk/types';

interface Props {
  orgId: string;
}

export function EventQuestionsStudio({ orgId }: Props) {
  const { ask, askConfirm, promptNode } = usePrompt();
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const [createOpen, setCreateOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<SdkEventQuestion | null>(null);
  
  // Search & Tabbed Filtering States (Phase 6)
  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['questions', orgId],
    queryFn: () => sdk.questions.list(orgId),
  });

  const questions = data?.questions || [];
  
  // Group questions
  const grouped = useMemo(() => {
    return questions.reduce((acc, q) => {
       if (!acc[q.group_name]) acc[q.group_name] = [];
       acc[q.group_name].push(q);
       return acc;
    }, {} as Record<string, SdkEventQuestion[]>);
  }, [questions]);

  // Sort groups (we'll just alphabetize for now)
  const groups = useMemo(() => {
    return Object.keys(grouped).sort();
  }, [grouped]);

  const filteredGrouped = useMemo(() => {
    const q = questionSearch.trim().toLowerCase();
    const result: Record<string, SdkEventQuestion[]> = {};
    
    Object.entries(grouped).forEach(([groupName, list]) => {
      const filteredList = list.filter(item => 
        item.question.toLowerCase().includes(q) || 
        groupName.toLowerCase().includes(q)
      );
      if (filteredList.length > 0) {
        result[groupName] = filteredList;
      }
    });
    
    return result;
  }, [grouped, questionSearch]);

  const filteredGroups = useMemo(() => {
    const keys = Object.keys(filteredGrouped).sort();
    if (selectedGroup === 'all') return keys;
    return keys.filter(k => k === selectedGroup);
  }, [filteredGrouped, selectedGroup]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.questions.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions', orgId] });
      toast({ title: 'Question deleted', variant: 'success' });
    }
  });

  const loadDefaultsMutation = useMutation({
    mutationFn: async () => {
      const defaults: any[] = [
        {
          question: 'What time will you arrive for early load-in?',
          groupName: 'Timeline & Scheduling',
          answerType: 'text',
          required: true,
          options: '[]',
          sortOrder: 1
        },
        {
          question: 'Expected reception start time?',
          groupName: 'Timeline & Scheduling',
          answerType: 'text',
          required: true,
          options: '[]',
          sortOrder: 2
        },
        {
          question: 'Do you require vegan/vegetarian alternatives?',
          groupName: 'Catering & Dining Options',
          answerType: 'boolean',
          required: true,
          options: '[]',
          sortOrder: 3
        },
        {
          question: 'Will there be late-night snacks served?',
          groupName: 'Catering & Dining Options',
          answerType: 'boolean',
          required: false,
          options: '[]',
          sortOrder: 4
        },
        {
          question: 'Choose your desired centerpiece design:',
          groupName: 'Floral & Centerpieces',
          answerType: 'dropdown',
          required: true,
          options: JSON.stringify(['Tall Glass Vases', 'Low Floral Runners', 'Candlelit Glass Lanterns', 'Rustic Wooden Boxes']),
          sortOrder: 5
        }
      ];

      for (const q of defaults) {
        await sdk.questions.create(orgId, q);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions', orgId] });
      toast({ title: 'Default questionnaire templates loaded successfully', variant: 'success' });
    },
    onError: (e: any) => {
      toast({ title: 'Failed to load defaults', description: e.message, variant: 'destructive' });
    }
  });

  const handleQuickAdd = async (presetType: string) => {
    try {
      let payload: any = {};
      if (presetType === 'logistics') {
        payload = {
          question: 'Do you require overnight storage of decor?',
          groupName: 'Logistics & Access',
          answerType: 'boolean',
          required: false,
          options: '[]',
          sortOrder: 10
        };
      } else if (presetType === 'music') {
        payload = {
          question: 'What is your primary song choice for the first dance?',
          groupName: 'Music & Entertainment',
          answerType: 'text',
          required: true,
          options: '[]',
          sortOrder: 15
        };
      } else {
        payload = {
          question: 'Will you have any external audio/visual crew?',
          groupName: 'A/V & Equipment',
          answerType: 'boolean',
          required: false,
          options: '[]',
          sortOrder: 20
        };
      }
      await sdk.questions.create(orgId, payload);
      qc.invalidateQueries({ queryKey: ['questions', orgId] });
      toast({ title: 'Event question preset added successfully', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Failed to quick add preset', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <PageBody>
      {promptNode}
         <Skeleton className="h-12 w-full mb-4" />
         <Skeleton className="h-[400px] w-full" />
      </PageBody>
    );
  }

  if (error) {
     return <PageBody><div className="text-danger">Failed to load questions.</div></PageBody>;
  }

  return (
    <>
      <PageHeader
        title="Event Questions Wizard"
        description="Configure the dynamic questionnaires sent to couples and planners."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
             <Plus className="w-4 h-4 mr-1" /> Add Question
          </Button>
        }
      />
      <PageBody>
         <div className="max-w-4xl space-y-6">
            {/* Quick Add Presets Panel */}
            <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
                  <Sparkles className="h-4 w-4 text-brand animate-pulse" /> Load Question Presets
                </h4>
                <p className="text-[10px] text-fg-subtle">Instantly inject typical event planning questions into your questionnaire.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="xs" variant="outline" onClick={() => handleQuickAdd('logistics')}>📦 Logistics &amp; Access</Button>
                <Button size="xs" variant="outline" onClick={() => handleQuickAdd('music')}>🎵 Music &amp; First Dance</Button>
                <Button size="xs" variant="outline" onClick={() => handleQuickAdd('av')}>🎬 A/V Crew Check</Button>
                <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={() => loadDefaultsMutation.mutate()} disabled={loadDefaultsMutation.isPending}>
                  💾 Load Question Defaults
                </Button>
              </div>
            </div>

            {/* Search & Category Tabbed Filters (Phase 6) */}
            {questions.length > 0 && (
               <div className="space-y-3 bg-paper p-4 rounded-2xl border border-paper-border shadow-sm">
                  <div className="flex border-b border-paper-border gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                    <button
                      onClick={() => setSelectedGroup('all')}
                      className={cn(
                        "pb-2 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap focus:outline-none",
                        selectedGroup === 'all' ? "border-brand text-brand" : "border-transparent text-fg-subtle hover:text-fg"
                      )}
                    >
                      All Categories
                    </button>
                    {groups.map(groupName => (
                      <button
                        key={groupName}
                        onClick={() => setSelectedGroup(groupName)}
                        className={cn(
                          "pb-2 px-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap focus:outline-none",
                          selectedGroup === groupName ? "border-brand text-brand" : "border-transparent text-fg-subtle hover:text-fg"
                        )}
                      >
                        {groupName}
                      </button>
                    ))}
                  </div>

                  <div>
                     <Input 
                        placeholder="Search questions by text or group name..." 
                        value={questionSearch}
                        onChange={(e) => setQuestionSearch(e.target.value)}
                        className="text-xs border-paper-border h-9"
                     />
                  </div>
               </div>
            )}

            {questions.length === 0 ? (
               <Card>
                  <div className="py-12 flex flex-col items-center text-center">
                    <ListTodo className="w-12 h-12 text-fg-subtle mb-4" />
                    <h3 className="text-lg font-medium">No questions configured</h3>
                    <p className="text-sm text-fg-muted max-w-sm mt-1 mb-4">
                      Build dynamic questionnaires to capture crucial details like layout preferences, centerpiece styles, and timelines.
                    </p>
                    <Button variant="outline" onClick={() => setCreateOpen(true)}>Add your first question</Button>
                  </div>
               </Card>
            ) : (
               filteredGroups.map(groupName => (
                  <div key={groupName} className="space-y-3 animate-in fade-in duration-200">
                     <h3 className="font-semibold text-sm flex items-center gap-2 border-b border-border pb-2 font-serif text-fg">
                       {groupName}
                       <Badge variant="outline" className="bg-paper text-brand border-paper-border font-bold text-[10px]">{filteredGrouped[groupName].length}</Badge>
                     </h3>
                     <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden divide-y divide-border bg-white">
                        {filteredGrouped[groupName]
                           .sort((a,b) => a.sort_order - b.sort_order)
                           .map(q => (
                           <div key={q.id} className="p-4 hover:bg-surface-2 transition-colors flex items-start gap-4">
                              <div className="text-fg-subtle cursor-grab active:cursor-grabbing mt-1 shrink-0">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-xs text-fg">{q.question}</span>
                                    {q.required === 1 && <span className="text-danger text-lg leading-none">*</span>}
                                 </div>
                                 <div className="flex gap-2">
                                    <Badge variant="outline" className="text-[9px] uppercase text-fg-muted bg-surface">{q.answer_type}</Badge>
                                    {(() => {
                                      try {
                                        const opts = JSON.parse(q.options || '[]');
                                        if (opts.length > 0) return <span className="text-xs text-fg-subtle">({opts.length} options)</span>;
                                      } catch {}
                                      return null;
                                    })()}
                                 </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                 <Button variant="ghost" size="icon" className="w-8 h-8 text-fg-muted hover:text-fg" onClick={() => setEditQuestion(q)}>
                                    <Edit2 className="w-4 h-4" />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="w-8 h-8 text-danger hover:bg-danger/10" onClick={async () => {
                                    if (await askConfirm({ title: 'Delete this question?', destructive: true })) deleteMutation.mutate(q.id);
                                 }}>
                                    <Trash2 className="w-4 h-4" />
                                 </Button>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               ))
            )}
         </div>

         {(createOpen || !!editQuestion) && (
            <QuestionFormDialog 
               orgId={orgId}
               open={createOpen || !!editQuestion}
               onOpenChange={(v) => {
                  if (!v) { setCreateOpen(false); setEditQuestion(null); }
               }}
               question={editQuestion}
               existingGroups={groups}
            />
         )}
      </PageBody>
    </>
  );
}
