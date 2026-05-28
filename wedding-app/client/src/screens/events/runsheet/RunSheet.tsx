import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Printer, MapPin, Truck, CheckSquare, Clock } from 'lucide-react';
import { sdk } from '../../../sdk';
import { PageBody, PageHeader } from '../../../ui/AppShell';
import { Button } from '../../../ui/Button';
import { Card, CardContent } from '../../../ui/Card';

interface Props {
  eventId: string;
}

export function RunSheet({ eventId }: Props) {
  const { data: eventData, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => sdk.events.get(eventId),
  });

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['timeline', eventId],
    queryFn: () => sdk.timeline.list(eventId),
  });

  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    queryKey: ['vendors', eventId],
    queryFn: () => {
      // Need org id which comes from event
      if (!eventData?.event?.organization_id) return Promise.resolve({ vendors: [] });
      return sdk.vendors.list(eventData.event.organization_id, { eventId });
    },
    enabled: !!eventData?.event,
  });

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staffTasks', eventId],
    queryFn: () => {
      if (!eventData?.event?.organization_id) return Promise.resolve({ tasks: [] });
      return sdk.staff.listTasks(eventData.event.organization_id, { eventId });
    },
    enabled: !!eventData?.event,
  });

  if (eventLoading || timelineLoading || vendorLoading || staffLoading) {
    return <div className="p-12 text-center text-fg-muted">Loading Run Sheet...</div>;
  }

  const event = eventData?.event;
  const timeline = [...(timelineData?.items || [])].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const vendors = vendorData?.vendors || [];
  const tasks = staffData?.tasks || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Hide page header during print to save space */}
      <div className="print:hidden">
        <PageHeader
          back={{ label: 'Back to Event', href: `#/events/${eventId}` }}
          title="Day-Of Run Sheet"
          description="Printable packet for staff and coordination."
          actions={
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Print Packet
            </Button>
          }
        />
      </div>

      <PageBody className="print:p-0 print:m-0 max-w-4xl">
        <div className="bg-white text-black p-8 sm:p-10 shadow-sm border border-border rounded-lg print:border-none print:shadow-none print:p-0">
          
          {/* Header */}
          <div className="border-b-2 border-black pb-6 mb-8">
            <h1 className="text-4xl font-display font-bold mb-2">{event?.title}</h1>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-1.5 font-medium">
                 <Clock className="w-4 h-4" /> 
                 {event?.start_date ? format(parseISO(event.start_date), 'EEEE, MMMM d, yyyy') : 'TBD'}
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                 <MapPin className="w-4 h-4" /> 
                 {event?.guest_count || 0} Guests Expected
              </div>
            </div>
          </div>

          {/* Section 1: Timeline */}
          <div className="mb-10 print:break-inside-avoid">
            <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b border-gray-300 pb-2">Run of Show</h2>
            <div className="space-y-0">
              {timeline.length === 0 ? (
                 <p className="text-gray-500 italic">No timeline events scheduled.</p>
              ) : (
                 timeline.map((item) => {
                   const time = format(parseISO(item.starts_at), 'h:mm a');
                   let notes = '';
                   try { notes = JSON.parse(item.metadata || '{}').notes || ''; } catch {}
                   
                   return (
                     <div key={item.id} className="flex border-b border-gray-100 py-3 page-break-inside-avoid">
                       <div className="w-32 font-bold shrink-0">{time}</div>
                       <div className="flex-1">
                         <div className="font-semibold text-lg">{item.title}</div>
                         <div className="text-sm text-gray-500 uppercase tracking-widest mt-0.5">{item.category.replace('_', ' ')}</div>
                         {notes && <div className="text-sm mt-1 text-gray-700 whitespace-pre-wrap">{notes}</div>}
                       </div>
                       {item.duration_min && (
                         <div className="w-24 text-right text-sm text-gray-500">{item.duration_min} min</div>
                       )}
                     </div>
                   );
                 })
              )}
            </div>
          </div>

          {/* Section 2: Vendors */}
          <div className="mb-10 print:break-inside-avoid">
            <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b border-gray-300 pb-2 flex items-center gap-2">
              <Truck className="w-5 h-5" /> Vendor Directory
            </h2>
            <div className="grid grid-cols-2 gap-4">
               {vendors.length === 0 ? (
                 <p className="text-gray-500 italic">No vendors listed.</p>
               ) : (
                 vendors.map(v => (
                   <div key={v.id} className="border border-gray-200 p-4 rounded bg-gray-50/50 print:border-gray-400">
                      <div className="font-bold">{v.name}</div>
                      <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">{v.category}</div>
                      {v.contact_name && <div className="text-sm">{v.contact_name}</div>}
                      {v.phone && <div className="text-sm">{v.phone}</div>}
                      {v.email && <div className="text-sm">{v.email}</div>}
                   </div>
                 ))
               )}
            </div>
          </div>

          {/* Section 3: Staff Tasks */}
          <div className="print:break-inside-avoid">
            <h2 className="text-xl font-bold uppercase tracking-wider mb-4 border-b border-gray-300 pb-2 flex items-center gap-2">
              <CheckSquare className="w-5 h-5" /> Staff Operations
            </h2>
            {['pre-event', 'during-event', 'post-event'].map(phase => {
               const phaseTasks = tasks.filter(t => t.phase === phase);
               if (phaseTasks.length === 0) return null;
               
               return (
                 <div key={phase} className="mb-6">
                    <h3 className="font-bold text-gray-600 uppercase text-sm mb-3 tracking-widest">{phase.replace('-', ' ')}</h3>
                    <div className="space-y-3">
                       {phaseTasks.map(task => (
                         <div key={task.id} className="flex gap-3">
                            <div className="w-5 h-5 border-2 border-gray-400 rounded-sm shrink-0 mt-0.5 print:border-black"></div>
                            <div>
                               <div className="font-semibold">{task.title}</div>
                               {task.description && <div className="text-sm text-gray-600 mt-0.5">{task.description}</div>}
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               );
            })}
            {tasks.length === 0 && <p className="text-gray-500 italic">No tasks assigned.</p>}
          </div>

        </div>
      </PageBody>
    </>
  );
}
