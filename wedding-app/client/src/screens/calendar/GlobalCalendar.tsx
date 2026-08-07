import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { parseDateOnly, formatDateOnly } from '../../lib/formatDate';
import { sdk } from '../../sdk';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { cn } from '../../ui/lib/cn';
import { STATUS_META } from '../events/statusMeta';
import { useRouter } from '../../lib/router';

interface Props {
  orgId: string;
}

export function GlobalCalendar({ orgId }: Props) {
  const { navigate } = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data, isLoading, error } = useQuery({
    queryKey: ['events', orgId, 'calendar'],
    queryFn: () => sdk.events.list(orgId),
  });

  const events = data?.events || [];

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    
    // Pad the start with days from the previous month to align with Sunday
    const startDay = start.getDay();
    const calendarStart = new Date(start);
    calendarStart.setDate(start.getDate() - startDay);
    
    // Pad the end to complete the grid (usually 42 cells total for a 6 week max overlap)
    const calendarEnd = new Date(calendarStart);
    calendarEnd.setDate(calendarStart.getDate() + 41);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const today = () => setCurrentDate(new Date());

  return (
    <>
      <PageHeader
        title="Event Calendar"
        description="Global view of all scheduled weddings and events."
        actions={
          <div className="flex items-center gap-2 bg-surface p-1 rounded-md border border-border">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous month" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" className="h-8 text-sm px-3" onClick={today} aria-label="Jump to current month">
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next month" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        }
      />
      <PageBody>
        <Card className="min-h-[600px] flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center bg-surface-2/30">
             <h2 className="text-xl font-display font-semibold">
               {format(currentDate, 'MMMM yyyy')}
             </h2>
          </div>
          
          <div className="flex-1 grid grid-cols-7 grid-rows-[auto_1fr] overflow-hidden text-xs sm:text-sm">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2 text-center text-xs font-medium text-fg-subtle border-b border-r border-border bg-surface last:border-r-0">
                {day}
              </div>
            ))}
            
            {isLoading ? (
              <div className="col-span-7 row-span-5 p-8 flex items-center justify-center">
                 <Skeleton className="w-full h-[500px] rounded-lg" />
              </div>
            ) : error ? (
               <div className="col-span-7 row-span-5 p-8 text-center text-danger text-sm">Failed to load calendar.</div>
            ) : (
              days.map((day, i) => {
                const isCurrentMonth = isSameMonth(day, currentDate);
                const dayEvents = events.filter(e => e.start_date && isSameDay(parseDateOnly(e.start_date) ?? new Date(0), day));
                
                return (
                  <div 
                    key={i} 
                    className={cn(
                      "min-h-[100px] p-1.5 border-b border-r border-border flex flex-col gap-1 transition-colors hover:bg-surface-2/50",
                      // Dim out-of-month cells via background tint + a darker
                      // text token — NEVER cell opacity, which drops the day
                      // number to ~2.3:1 contrast (WCAG AA failure).
                      !isCurrentMonth && "bg-surface-2/40",
                      (i + 1) % 7 === 0 && "border-r-0",
                      i >= 35 && "border-b-0"
                    )}
                  >
                    <div className="flex justify-between items-center px-1">
                      <span className={cn(
                        "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                        isToday(day) ? "bg-brand text-brand-fg" : isCurrentMonth ? "text-fg-muted" : "text-fg-subtle"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto no-scrollbar">
                      {dayEvents.map(e => {
                        const meta = STATUS_META[e.status];
                        return (
                          <div
                            key={e.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Open ${e.title}${e.start_date ? ` on ${formatDateOnly(e.start_date)}` : ''}`}
                            onClick={() => navigate(`/events/${e.id}`)}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Enter' || ev.key === ' ') {
                                ev.preventDefault();
                                navigate(`/events/${e.id}`);
                              }
                            }}
                            className={cn(
                              "text-[10px] px-1.5 py-1 rounded cursor-pointer truncate font-medium border",
                              "hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand transition-all"
                            )}
                            style={{
                              backgroundColor: `${meta.dotColor}20`,
                              borderColor: `${meta.dotColor}40`,
                              color: meta.dotColor
                            }}
                            title={e.title}
                          >
                            {e.title}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </PageBody>
    </>
  );
}
