import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, MoreVertical, Trash2, Edit2, CheckCircle2, Circle } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { SdkTimelineItem } from '../../../sdk/types';
import { Button } from '../../../ui/Button';
import { Card, CardContent } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { Badge } from '../../../ui/Badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../../ui/DropdownMenu';
import { TimelineItemFormDialog } from './TimelineItemFormDialog';
import { cn } from '../../../ui/lib/cn';
import { format, parseISO } from 'date-fns';

interface Props {
  eventId: string;
}

export function EventTimelineTab({ eventId }: Props) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<SdkTimelineItem | null>(null);

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
  const sortedItems = [...items].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-fg">Run of Show</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Item
        </Button>
      </div>

      {sortedItems.length === 0 ? (
        <Card>
          <div className="py-12 flex flex-col items-center text-center">
            <Clock className="w-12 h-12 text-fg-subtle mb-4" />
            <h3 className="text-lg font-medium">No timeline events</h3>
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
              <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group mb-8 last:mb-0">
                
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
                  "w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] hover:shadow-elev-1 transition-shadow",
                  isCompleted && "opacity-70"
                )}>
                  <CardContent className="p-4 flex gap-4 relative">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-fg">{timeFormatted}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{item.category}</Badge>
                      </div>
                      <h4 className={cn("text-base font-medium text-fg truncate", isCompleted && "line-through")}>
                        {item.title}
                      </h4>
                      {item.duration_min && (
                        <p className="text-xs text-fg-muted mt-1">{item.duration_min} mins</p>
                      )}
                      
                      {/* Optional data rendering from metadata */}
                      {item.metadata && (() => {
                        try {
                          const meta = JSON.parse(item.metadata);
                          if (meta.notes) return <p className="text-xs text-fg-subtle mt-2 line-clamp-2">{meta.notes}</p>;
                        } catch {}
                        return null;
                      })()}
                    </div>
                    
                    {/* Actions Menu */}
                    <div>
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
