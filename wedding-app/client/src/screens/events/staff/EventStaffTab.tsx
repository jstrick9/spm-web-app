import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Circle, ClipboardList, Plus } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { SdkStaffTask } from '../../../sdk/types';
import { Button } from '../../../ui/Button';
import { Card, CardContent } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { Badge } from '../../../ui/Badge';
import { cn } from '../../../ui/lib/cn';
import { StaffTaskFormDialog } from './StaffTaskFormDialog';

interface Props {
  eventId: string;
  organizationId: string;
}

export function EventStaffTab({ eventId, organizationId }: Props) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<SdkStaffTask | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['staffTasks', eventId],
    queryFn: () => sdk.staff.listTasks(organizationId, { eventId }),
  });

  const updatePhaseMutation = useMutation({
    mutationFn: ({ task, newPhase }: { task: SdkStaffTask, newPhase: any }) => {
      return sdk.staff.updateTask(task.id, { phase: newPhase });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staffTasks', eventId] })
  });

  const handleDragStart = (e: React.DragEvent, task: SdkStaffTask) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.currentTarget.classList.add('opacity-40');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-40');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-surface-3');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-surface-3');
  };

  const handleDrop = (e: React.DragEvent, phaseId: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-surface-3');
    
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.phase !== phaseId) {
      // Optimistic update locally
      qc.setQueryData(['staffTasks', eventId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks.map((t: SdkStaffTask) => t.id === taskId ? { ...t, phase: phaseId } : t)
        };
      });
      updatePhaseMutation.mutate({ task, newPhase: phaseId });
    }
  };

  const toggleTaskStatus = useMutation({
    mutationFn: (task: SdkStaffTask) => {
      const newStatus = task.status === 'completed' ? 'not-started' : 'completed';
      return sdk.staff.updateTask(task.id, { status: newStatus });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staffTasks', eventId] })
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <Card><CardContent className="pt-6 text-danger text-sm">Failed to load tasks.</CardContent></Card>;
  }

  const tasks = data?.tasks || [];

  const phases = [
    { id: 'pre-event', label: 'Pre-Event Prep' },
    { id: 'during-event', label: 'Day-Of Execution' },
    { id: 'post-event', label: 'Post-Event Teardown' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-fg">Staff Tasks</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <div className="py-12 flex flex-col items-center text-center">
            <ClipboardList className="w-12 h-12 text-fg-subtle mb-4" />
            <h3 className="text-lg font-medium">No tasks assigned</h3>
            <p className="text-sm text-fg-muted max-w-sm mt-1 mb-4">
              Create setup requirements, cleaning checklists, or day-of coordinator duties.
            </p>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>Create task</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {phases.map(phase => {
            const phaseTasks = tasks.filter(t => t.phase === phase.id);
            return (
              <div key={phase.id} className="flex flex-col gap-3 h-full rounded-lg transition-colors border border-transparent"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, phase.id)}
              >
                <h3 className="font-semibold text-sm text-fg flex justify-between items-center bg-surface-2 p-2 rounded border border-border">
                  {phase.label}
                  <Badge variant="outline" className="text-[10px]">{phaseTasks.length}</Badge>
                </h3>
                
                {phaseTasks.length === 0 ? (
                  <div className="text-center p-4 border border-dashed border-border rounded text-xs text-fg-muted">
                     No tasks scheduled
                  </div>
                ) : (
                  <div className="space-y-3">
                    {phaseTasks.map(task => {
                      const isCompleted = task.status === 'completed';
                      return (
                        <Card 
                          key={task.id} 
                          className={cn("cursor-pointer hover:shadow-elev-1 transition-all active:cursor-grabbing cursor-grab", isCompleted && "opacity-60")}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={handleDragEnd}
                          onClick={() => setEditTask(task)}
                        >
                          <CardContent className="p-3 flex gap-3">
                            <button 
                              className={cn("shrink-0 mt-0.5", isCompleted ? "text-success" : "text-fg-subtle hover:text-brand")}
                              onClick={(e) => { e.stopPropagation(); toggleTaskStatus.mutate(task); }}
                            >
                              {isCompleted ? <CheckSquare className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <h4 className={cn("text-sm font-medium", isCompleted && "line-through text-fg-muted")}>
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-xs text-fg-subtle mt-1 line-clamp-2">{task.description}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant={
                                  task.priority === 'critical' ? 'danger' :
                                  task.priority === 'high' ? 'brand' :
                                  'outline'
                                } className="text-[10px]">
                                  {task.priority} priority
                                </Badge>
                                {task.assigned_staff.length > 0 && (
                                  <Badge variant="outline" className="text-[10px] bg-surface-2">
                                    {task.assigned_staff.length} assigned
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(createOpen || !!editTask) && (
        <StaffTaskFormDialog
          eventId={eventId}
          organizationId={organizationId}
          open={createOpen || !!editTask}
          onOpenChange={(v) => {
            if (!v) {
              setCreateOpen(false);
              setEditTask(null);
            }
          }}
          task={editTask}
        />
      )}
    </div>
  );
}
