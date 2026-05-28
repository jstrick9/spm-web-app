import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sdk } from '../../../sdk';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { Clock, AlertTriangle } from 'lucide-react';
import { parseISO, differenceInMinutes, startOfDay, endOfDay, format } from 'date-fns';

interface Props {
  eventId: string;
}

export function VendorTimelineChart({ eventId }: Props) {
  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['timeline', eventId],
    queryFn: () => sdk.timeline.list(eventId),
  });

  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    // Need to look up vendors by event
    queryKey: ['vendors', eventId],
    queryFn: async () => {
      const e = await sdk.events.get(eventId);
      return sdk.vendors.list(e.event.organization_id, { eventId });
    },
  });

  if (timelineLoading || vendorLoading) {
    return <Card><CardContent className="pt-6"><Skeleton className="h-64" /></CardContent></Card>;
  }

  const items = timelineData?.items || [];
  const vendors = vendorData?.vendors || [];

  // Filter timeline items specifically tied to vendors
  const vendorEvents = items.filter(i => i.vendor_id);
  
  if (vendors.length === 0 || vendorEvents.length === 0) {
    return (
      <Card>
         <CardContent className="py-12 flex flex-col items-center text-center text-fg-muted">
            <Clock className="w-10 h-10 mb-3 opacity-20" />
            <p>No vendor-specific timeline events scheduled yet.</p>
         </CardContent>
      </Card>
    );
  }

  // Calculate day boundaries
  const firstEvent = [...vendorEvents].sort((a,b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
  const dayStart = startOfDay(parseISO(firstEvent.starts_at));
  
  // We'll map a 6am to Midnight view (18 hours)
  const START_HOUR = 6;
  const END_HOUR = 24; 
  const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

  // We want to detect overlaps natively.
  const conflicts: Array<{ id1: string; id2: string; msg: string }> = [];

  const vendorTracks = vendors.map(v => {
    const trackEvents = vendorEvents.filter(e => e.vendor_id === v.id);
    if (trackEvents.length === 0) return null;
    
    // Convert to percentage spans
    const spans = trackEvents.map(e => {
       const start = parseISO(e.starts_at);
       // Ensure start is normalized to the day map
       const offsetMins = differenceInMinutes(start, dayStart);
       const minutesFrom6am = offsetMins - (START_HOUR * 60);
       
       const duration = e.duration_min || 60; // default 1 hr
       
       const leftPct = Math.max(0, Math.min(100, (minutesFrom6am / TOTAL_MINUTES) * 100));
       const widthPct = Math.min(100 - leftPct, (duration / TOTAL_MINUTES) * 100);
       
       return {
         ...e,
         leftPct,
         widthPct,
         startMins: offsetMins,
         endMins: offsetMins + duration
       };
    });
    
    return { vendor: v, spans };
  }).filter(Boolean);

  // Cross-check for overlaps globally
  const allSpans = vendorTracks.flatMap(t => t!.spans.map(s => ({ ...s, vendorName: t!.vendor.name })));
  
  for (let i = 0; i < allSpans.length; i++) {
    for (let j = i + 1; j < allSpans.length; j++) {
      const a = allSpans[i];
      const b = allSpans[j];
      
      // If same vendor, ignore overlap in this context (or we could warn)
      if (a.vendor_id === b.vendor_id) continue;
      
      const overlap = (a.startMins < b.endMins) && (a.endMins > b.startMins);
      // Let's assume conflict matters if they are both arriving
      if (overlap && (a.category === 'vendor_arrival' || a.category === 'prep') && (b.category === 'vendor_arrival' || b.category === 'prep')) {
         conflicts.push({
           id1: a.id,
           id2: b.id,
           msg: `${a.vendorName} and ${b.vendorName} are scheduled to arrive/prep simultaneously at ${format(parseISO(a.starts_at), 'h:mm a')}`
         });
      }
    }
  }

  return (
    <Card className="overflow-hidden">
       <CardHeader className="bg-surface-2 border-b border-border py-4">
         <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                 <Clock className="w-4 h-4 text-brand" /> Vendor Timeline Chart
              </CardTitle>
              <CardDescription className="mt-1">Horizontal span mapping of vendor load-ins and departures.</CardDescription>
            </div>
            {conflicts.length > 0 && (
               <div className="flex items-center gap-2 bg-danger-soft text-danger px-3 py-1.5 rounded-md text-xs font-medium border border-danger/20">
                 <AlertTriangle className="w-4 h-4" /> {conflicts.length} Overlap Conflicts Detected
               </div>
            )}
         </div>
       </CardHeader>
       <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[800px] p-6">
             
             {/* Timeline Header (Hours) */}
             <div className="flex relative h-6 mb-4 ml-32 border-b border-border">
                {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                  <div key={i} className="absolute text-[10px] text-fg-muted font-mono transform -translate-x-1/2" style={{ left: `${(i / (END_HOUR - START_HOUR)) * 100}%` }}>
                     {START_HOUR + i > 12 ? `${START_HOUR + i - 12}pm` : START_HOUR + i === 12 ? '12pm' : `${START_HOUR + i}am`}
                     <div className="w-px h-2 bg-border mx-auto mt-1" />
                  </div>
                ))}
             </div>

             {/* Tracks */}
             <div className="space-y-4">
                {vendorTracks.map((track, idx) => (
                  <div key={track!.vendor.id} className="flex relative h-10 items-center group">
                     {/* Vendor Label */}
                     <div className="w-32 shrink-0 pr-4 text-right">
                       <div className="text-xs font-semibold text-fg truncate">{track!.vendor.name}</div>
                       <div className="text-[9px] text-fg-subtle uppercase tracking-wider truncate">{track!.vendor.category}</div>
                     </div>
                     
                     {/* Span Container */}
                     <div className="flex-1 h-full relative bg-surface-2/30 rounded border-y border-border group-hover:bg-surface-2/60 transition-colors">
                        {/* Grid lines */}
                        {Array.from({ length: END_HOUR - START_HOUR }).map((_, i) => (
                          <div key={i} className="absolute top-0 bottom-0 w-px bg-border/40" style={{ left: `${(i / (END_HOUR - START_HOUR)) * 100}%` }} />
                        ))}

                        {/* Spans */}
                        {track!.spans.map(span => {
                           const isConflict = conflicts.some(c => c.id1 === span.id || c.id2 === span.id);
                           return (
                             <div 
                               key={span.id}
                               className={`absolute top-2 h-6 rounded-sm shadow-sm flex items-center px-2 overflow-hidden text-[9px] font-medium text-white transition-transform hover:scale-y-110 cursor-pointer ${isConflict ? 'bg-danger border border-danger/50' : 'bg-brand'}`}
                               style={{ left: `${span.leftPct}%`, width: `${span.widthPct}%` }}
                               title={`${span.title} (${format(parseISO(span.starts_at), 'h:mm a')})`}
                             >
                                <span className="truncate">{span.title}</span>
                             </div>
                           );
                        })}
                     </div>
                  </div>
                ))}
             </div>

          </div>

          {/* Conflict details block */}
          {conflicts.length > 0 && (
            <div className="bg-danger/5 border-t border-danger/20 p-4">
               <h4 className="text-xs font-bold text-danger uppercase tracking-wider mb-2 flex items-center gap-1">
                 <AlertTriangle className="w-3 h-3" /> Logistical Warnings
               </h4>
               <ul className="space-y-1 text-xs text-danger/80 list-disc pl-4">
                 {conflicts.map((c, i) => (
                   <li key={i}>{c.msg}</li>
                 ))}
               </ul>
            </div>
          )}
       </CardContent>
    </Card>
  );
}
