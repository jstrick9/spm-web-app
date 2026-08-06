import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/Dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '../../../ui/Form';
import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/Select';
import { useToast } from '../../../ui/Toast';
import { timelineSdk } from '../../../sdk/timeline';
import type { SdkTimelineItem } from '../../../sdk/types';
import { format, parseISO } from 'date-fns';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  time: z.string().min(1, 'Time is required'),
  durationMinStr: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  item: SdkTimelineItem | null;
  /** The event's start_date ('YYYY-MM-DD') — timeline items are anchored to
   *  the WEDDING day so reminders, ICS exports, and late-checks align. */
  eventStartDate?: string | null;
}

const CATEGORIES = [
  'ceremony', 'reception', 'photography', 'vendor_arrival', 'prep', 'other'
];

export function TimelineItemFormDialog({ open, onOpenChange, eventId, item, eventStartDate }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const isEdit = !!item;

  let defaultTime = '12:00';
  let defaultNotes = '';
  if (item) {
    try {
      defaultTime = format(parseISO(item.starts_at), 'HH:mm');
      const meta = JSON.parse(item.metadata || '{}');
      defaultNotes = meta.notes || '';
    } catch {}
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: item?.title || '',
      category: item?.category || 'other',
      time: defaultTime,
      durationMinStr: item?.duration_min ? String(item.duration_min) : '',
      notes: defaultNotes,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Build a valid ISO timestamp from form time inputs.
      // Anchor to the EVENT's wedding date when known — anchoring to
      // TODAY stored every item on the creation day: guest ICS exports
      // showed the ceremony on the wrong day, and items were flagged
      // "late" the same evening they were created (readiness + reminders
      // broke for future weddings).
      const [hh, mm] = values.time.split(':');
      const pad = (n: string) => n.padStart(2, '0');
      const startsAt = eventStartDate
        ? new Date(`${eventStartDate}T${pad(hh)}:${pad(mm)}:00`)
        : (() => { const d = new Date(); d.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0); return d; })();

      const durationMin = values.durationMinStr ? parseInt(values.durationMinStr, 10) : undefined;
      
      const payload = {
        title: values.title,
        category: values.category,
        startsAt: startsAt.toISOString(),
        durationMin,
        metadata: { notes: values.notes }
      };

      if (isEdit) {
        return timelineSdk.update(item!.id, payload);
      } else {
        return timelineSdk.create(eventId, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timeline', eventId] });
      toast({ title: isEdit ? 'Item updated' : 'Item added', variant: 'success' });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({ title: 'Failed to save', description: e.message, variant: 'destructive' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Timeline Item' : 'Add Timeline Item'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Title *</FormLabel>
                  <FormControl><Input placeholder="e.g., Cocktail Hour" {...field} autoFocus /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
               <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time *</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="durationMinStr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (mins)</FormLabel>
                      <FormControl><Input type="number" min="0" placeholder="60" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes / Details</FormLabel>
                  <FormControl>
                    <textarea 
                      className="flex min-h-[80px] w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Special instructions for the team..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 mt-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Item'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
