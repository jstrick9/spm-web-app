import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ListTodo, Edit2, Trash2, GripVertical, Settings2 } from 'lucide-react';
import { PageBody, PageHeader } from '../../../ui/AppShell';
import { Card, CardContent } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { sdk } from '../../../sdk';
import { useToast } from '../../../ui/Toast';
import { Skeleton } from '../../../ui/Skeleton';
import { QuestionFormDialog } from './QuestionFormDialog';
import type { SdkEventQuestion } from '../../../sdk/types';

interface Props {
  orgId: string;
}

export function EventQuestionsStudio({ orgId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const [createOpen, setCreateOpen] = useState(false);
  const [editQuestion, setEditQuestion] = useState<SdkEventQuestion | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['questions', orgId],
    queryFn: () => sdk.questions.list(orgId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.questions.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions', orgId] });
      toast({ title: 'Question deleted', variant: 'success' });
    }
  });

  if (isLoading) {
    return (
      <PageBody>
         <Skeleton className="h-12 w-full mb-4" />
         <Skeleton className="h-[400px] w-full" />
      </PageBody>
    );
  }

  if (error) {
     return <PageBody><div className="text-danger">Failed to load questions.</div></PageBody>;
  }

  const questions = data?.questions || [];
  
  // Group questions
  const grouped = questions.reduce((acc, q) => {
     if (!acc[q.group_name]) acc[q.group_name] = [];
     acc[q.group_name].push(q);
     return acc;
  }, {} as Record<string, SdkEventQuestion[]>);

  // Sort groups (we'll just alphabetize for now)
  const groups = Object.keys(grouped).sort();

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
         <div className="max-w-4xl space-y-8">
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
               groups.map(groupName => (
                  <div key={groupName} className="space-y-3">
                     <h3 className="font-semibold text-lg flex items-center gap-2 border-b border-border pb-2">
                       {groupName}
                       <Badge variant="outline">{grouped[groupName].length}</Badge>
                     </h3>
                     <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden divide-y divide-border">
                        {grouped[groupName]
                           .sort((a,b) => a.sort_order - b.sort_order)
                           .map(q => (
                           <div key={q.id} className="p-4 hover:bg-surface-2 transition-colors flex items-start gap-4">
                              <div className="text-fg-subtle cursor-grab active:cursor-grabbing mt-1 shrink-0">
                                <GripVertical className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-fg">{q.question}</span>
                                    {q.required === 1 && <span className="text-danger text-lg leading-none">*</span>}
                                 </div>
                                 <div className="flex gap-2">
                                    <Badge variant="outline" className="text-[10px] uppercase text-fg-muted bg-surface">{q.answer_type}</Badge>
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
                                 <Button variant="ghost" size="icon" className="w-8 h-8 text-danger hover:bg-danger/10" onClick={() => {
                                    if(window.confirm('Delete this question?')) deleteMutation.mutate(q.id);
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
