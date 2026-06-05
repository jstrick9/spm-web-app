import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, MoreVertical, Trash2, Edit2, CheckCircle2, Circle, Sparkles, Move } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { SdkTimelineItem } from '../../../sdk/types';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { Badge } from '../../../ui/Badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../../ui/DropdownMenu';
import { TimelineItemFormDialog } from './TimelineItemFormDialog';
import { cn } from '../../../ui/lib/cn';
import { format, parseISO } from 'date-fns';
import { useToast } from '../../../ui/Toast';

interface Props {
  eventId: string;
  organizationId: string;
}

export function EventTimelineTab({ eventId, organizationId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<SdkTimelineItem | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [draggedTimelineId, setDraggedTimelineId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['timeline', eventId],
    queryFn: () => sdk.timeline.list(eventId),
  });

  const toggleStatus = useMutation({
    mutationFn: (item: SdkTimelineItem) => sdk.timeline.update(item.id, { completed: item.completed === 1 ? false : true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline', eventId] })
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => sdk.timeline.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline', eventId] })
  });

  const items = data?.items || [];
  
  // Sort items by starts_at
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  }, [items]);

  // Timeline-to-Task Smart Automator Scanner (Phase 2)
  const handleTriggerAutomation = async () => {
    setIsSyncing(true);
    try {
      const existingTasks = await sdk.staff.listTasks(organizationId, { eventId });
      const taskTitles = new Set(existingTasks.tasks.map(t => t.title.toLowerCase()));

      let createdCount = 0;

      for (const item of sortedItems) {
        const startsDate = new Date(item.starts_at);
        const timeFormatted = format(parseISO(item.starts_at), 'h:mm a');
        
        if (item.category?.toLowerCase() === 'ceremony' && !taskTitles.has('set up ceremony chairs & archways')) {
          const dueAtDate = new Date(startsDate.getTime() - 60 * 60 * 1000);
          await sdk.staff.createTask(organizationId, {
            title: 'Set up ceremony chairs & archways',
            eventId,
            phase: 'pre-event',
            priority: 'high',
            dueAt: dueAtDate.toISOString(),
            description: `Automated setup task linked to milestone: "${item.title}" starting at ${timeFormatted}.`
          });
          createdCount++;
        }

        if (item.category?.toLowerCase() === 'reception' && !taskTitles.has('drape dining linens & arrange tables')) {
          const dueAtDate = new Date(startsDate.getTime() - 120 * 60 * 1000);
          await sdk.staff.createTask(organizationId, {
            title: 'Drape dining linens & arrange tables',
            eventId,
            phase: 'pre-event',
            priority: 'critical',
            dueAt: dueAtDate.toISOString(),
            description: `Automated setup task linked to milestone: "${item.title}" starting at ${timeFormatted}.`
          });
          createdCount++;
        }

        if (item.category?.toLowerCase() === 'cocktail' && !taskTitles.has('configure cocktail bar glassware & garnishes')) {
          const dueAtDate = new Date(startsDate.getTime() - 30 * 60 * 1000);
          await sdk.staff.createTask(organizationId, {
            title: 'Configure cocktail bar glassware & garnishes',
            eventId,
            phase: 'pre-event',
            priority: 'medium',
            dueAt: dueAtDate.toISOString(),
            description: `Automated setup task linked to milestone: "${item.title}" starting at ${timeFormatted}.`
          });
          createdCount++;
        }
      }

      qc.invalidateQueries({ queryKey: ['staffTasks', eventId] });
      if (createdCount > 0) {
        toast({ title: 'Scheduler scan complete', description: `Successfully synchronized and auto-populated ${createdCount} operational tasks!`, variant: 'success' });
      } else {
        toast({ title: 'Scheduler up to date', description: 'All operational tasks are already synchronized with your timeline milestones.' });
      }
    } catch (e: any) {
      toast({ title: 'Automation sync failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Drag-and-Drop Milestones Swapping (Phase 6)
  const handleTimelineDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedTimelineId(id);
    e.currentTarget.classList.add('opacity-40');
  };

  const handleTimelineDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-40');
    setDraggedTimelineId(null);
  };

  const handleTimelineDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleTimelineDrop = async (e: React.DragEvent, targetItem: SdkTimelineItem) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (!draggedId || draggedId === targetItem.id) return;

    const draggedItem = items.find(i => i.id === draggedId);
    if (!draggedItem) return;

    try {
      // Optimistic locally set query data
      qc.setQueryData(['timeline', eventId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((i: SdkTimelineItem) => {
            if (i.id === draggedId) return { ...i, starts_at: targetItem.starts_at };
            if (i.id === targetItem.id) return { ...i, starts_at: draggedItem.starts_at };
            return i;
          })
        };
      });

      await sdk.timeline.update(draggedId, { startsAt: targetItem.starts_at });
      await sdk.timeline.update(targetItem.id, { startsAt: draggedItem.starts_at });
      qc.invalidateQueries({ queryKey: ['timeline', eventId] });
      toast({ title: 'Milestones swapped successfully', description: `Swapped chronological start times between "${draggedItem.title}" and "${targetItem.title}".`, variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Failed to swap times', description: err.message, variant: 'destructive' });
    }
  };

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
    return (
      <Card>
        <CardContent className="pt-6 text-danger text-sm">Failed to load timeline.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Smart Timeline-to-Task Automator Control Panel */}
      <Card className="border border-brand/20 bg-brand-soft/5">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-semibold">
           <div className="space-y-1">
              <h4 className="text-sm font-bold text-brand font-serif flex items-center gap-1.5">
                 <Sparkles className="h-4.5 w-4.5 text-brand animate-pulse" /> Timeline-to-Task Smart Automator
              </h4>
              <p className="text-[10px] text-fg-subtle font-medium leading-relaxed max-w-xl">
                 Enable our data-driven operations scanner to automatically link wedding milestones (ceremony, reception, toast) to staff checklists, auto-generating setup and coordination tasks in real-time.
              </p>
           </div>
           
           <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="font-bold border-[#e1d5c9] bg-white hover:bg-brand-soft/20 text-brand text-[10px]"
                onClick={() => handleTriggerAutomation()}
                disabled={isSyncing}
              >
                 {isSyncing ? 'Syncing...' : '⚡ Scan & Auto-Populate Checklist'}
              </Button>
           </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-fg-subtle font-serif">Run of Show (Milestones)</h2>
        <Button onClick={() => setCreateOpen(true)} className="font-bold">
          <Plus className="w-4 h-4 mr-1" /> Add Item
        </Button>
      </div>

      {sortedItems.length === 0 ? (
        <Card className="border-[#e1d5c9] bg-[#FDFBF7]">
          <div className="py-12 flex flex-col items-center text-center">
            <Clock className="w-12 h-12 text-fg-subtle mb-4" />
            <h3 className="text-lg font-medium font-serif text-fg">No timeline events</h3>
            <p className="text-sm text-fg-muted max-w-sm mt-1 mb-4">
              Build the day-of schedule to keep your vendors, staff, and couples on track.
            </p>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>Create first item</Button>
          </div>
        </Card>
      ) : (
        <div className="relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {sortedItems.map((item, index) => {
            const isCompleted = item.completed === 1;
            const timeFormatted = format(parseISO(item.starts_at), 'h:mm a');
            
            return (
              <div 
                key={item.id} 
                className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group mb-8 last:mb-0"
                draggable
                onDragStart={(e) => handleTimelineDragStart(e, item.id)}
                onDragEnd={handleTimelineDragEnd}
                onDragOver={handleTimelineDragOver}
                onDrop={(e) => handleTimelineDrop(e, item)}
              >
                
                {/* Timeline dot */}
                <div 
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface bg-surface shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 cursor-pointer transition-colors",
                    isCompleted ? "text-success" : "text-fg-subtle hover:text-brand"
                  )}
                  onClick={() => toggleStatus.mutate(item)}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </div>
                
                {/* Content Card */}
                <Card className={cn(
                  "w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:shadow-md transition-shadow border-[#e1d5c9] active:cursor-grabbing cursor-grab",
                  isCompleted && "opacity-70"
                )}>
                  <CardContent className="p-4 flex gap-4 relative bg-white">
                    <div className="flex-1 min-w-0 text-fg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-fg flex items-center gap-1">
                           <Move className="w-3.5 h-3.5 text-fg-subtle" />
                           {timeFormatted}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize bg-[#FDFBF7] text-brand border-[#e1d5c9] font-bold">{item.category}</Badge>
                      </div>
                      <h4 className={cn("text-sm font-bold text-fg truncate font-serif", isCompleted && "line-through text-fg-subtle")}>
                        {item.title}
                      </h4>
                      {item.duration_min && (
                        <p className="text-xs text-fg-subtle font-semibold mt-1">{item.duration_min} mins duration</p>
                      )}
                      
                      {/* Optional data rendering from metadata */}
                      {item.metadata && (() => {
                        try {
                          const meta = JSON.parse(item.metadata);
                          if (meta.notes) return <p className="text-xs text-fg-muted font-semibold mt-2.5 bg-[#FDFBF7] p-2.5 border rounded-lg italic">"{meta.notes}"</p>;
                        } catch {}
                        return null;
                      })()}
                    </div>
                    
                    {/* Actions Menu */}
                    <div className="print:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-fg-muted hover:text-fg">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditItem(item)}>
                            <Edit2 className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-danger focus:text-danger focus:bg-danger/10"
                            onClick={() => {
                              if (window.confirm('Delete this timeline item?')) {
                                deleteItem.mutate(item.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog covers both Create and Edit modes */}
      {(createOpen || !!editItem) && (
        <TimelineItemFormDialog
          eventId={eventId}
          open={createOpen || !!editItem}
          onOpenChange={(v) => {
            if (!v) {
              setCreateOpen(false);
              setEditItem(null);
            }
          }}
          item={editItem}
        />
      )}
    </div>
  );
}
