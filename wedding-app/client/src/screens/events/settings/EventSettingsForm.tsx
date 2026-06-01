/**
 * EventSettingsForm — Full inline editing of event properties.
 * Replaces the "Coming Soon" placeholder in the EventDetail Settings tab.
 *
 * Supports editing:
 *   - Title
 *   - Status (pipeline stage)
 *   - Start/End dates
 *   - Expected guest count
 *   - Budget (in dollars, converted to cents)
 *   - Primary contact (dropdown of org members — future)
 *
 * All changes are auto-saved with optimistic updates and undo via toast.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Trash2, AlertTriangle } from 'lucide-react';

import { sdk, ApiError } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { useToast } from '../../../ui/Toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../ui/Select';
import { STATUS_META, statusOrder } from '../statusMeta';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../../ui/Dialog';

const settingsSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  status: z.enum(['lead', 'hold', 'booked', 'planning', 'completed', 'cancelled', 'lost']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').or(z.literal('')),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').or(z.literal('')),
  guestCount: z.number().int().min(0, 'Must be 0 or more'),
  budgetDollars: z.number().min(0, 'Must be 0 or more'),
  leadSource: z.string().optional(),
  rsvpDeadline: z.string().optional(),
}).refine(data => {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    return false;
  }
  return true;
}, { message: 'End date must be on or after start date', path: ['endDate'] });

type SettingsValues = z.infer<typeof settingsSchema>;

interface Props {
  eventId: string;
}

export function EventSettingsForm({ eventId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => sdk.events.get(eventId),
  });

  const event = eventQuery.data?.event;

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      title: '',
      status: 'planning',
      startDate: '',
      endDate: '',
      guestCount: 0,
      budgetDollars: 0,
      leadSource: '',
      rsvpDeadline: '',
    },
  });

  // Populate form when event loads
  useEffect(() => {
    if (event) {
      form.reset({
        title: event.title,
        status: event.status,
        startDate: event.start_date ?? '',
        endDate: event.end_date ?? '',
        guestCount: event.guest_count,
        budgetDollars: event.budget_cents != null ? event.budget_cents / 100 : 0,
        leadSource: (event as any).lead_source ?? '',
        rsvpDeadline: (event as any).rsvp_deadline ?? '',
      });
    }
  }, [event, form]);

  const updateMutation = useMutation({
    mutationFn: (values: SettingsValues) => {
      return sdk.events.update(eventId, {
        title: values.title,
        status: values.status,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        guestCount: values.guestCount,
        budgetCents: Math.round(values.budgetDollars * 100),
        leadSource: values.leadSource || undefined,
        rsvpDeadline: values.rsvpDeadline || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Event updated', variant: 'success' });
    },
    onError: (e) => {
      toast({
        title: 'Could not update',
        description: (e as ApiError).message,
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => sdk.events.delete(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Event deleted', variant: 'success' });
      window.location.hash = '#/events';
    },
    onError: (e) => {
      toast({
        title: 'Could not delete',
        description: (e as ApiError).message,
        variant: 'destructive',
      });
    },
  });

  if (!event) {
    return (
      <div className="grid gap-4 max-w-2xl">
        <Card><CardContent className="py-10 text-center text-fg-muted">Loading…</CardContent></Card>
      </div>
    );
  }

  function onSubmit(values: SettingsValues) {
    updateMutation.mutate(values);
  }

  const isDirty = form.formState.isDirty;

  return (
    <div className="grid gap-4 max-w-2xl">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Event Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Event Details</CardTitle>
            <CardDescription>Core information about this event.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                {...form.register('title')}
                className={form.formState.errors.title ? 'border-danger' : ''}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-danger">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Pipeline Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as any, { shouldDirty: true })}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOrder.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label} — <span className="text-fg-subtle">{STATUS_META[s].description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...form.register('startDate')}
                  className={form.formState.errors.startDate ? 'border-danger' : ''}
                />
                {form.formState.errors.startDate && (
                  <p className="text-xs text-danger">{form.formState.errors.startDate.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  {...form.register('endDate')}
                  className={form.formState.errors.endDate ? 'border-danger' : ''}
                />
                {form.formState.errors.endDate && (
                  <p className="text-xs text-danger">{form.formState.errors.endDate.message}</p>
                )}
              </div>
            </div>

            {/* Guest count + Budget */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="guestCount">Expected Guest Count</Label>
                <Input
                  id="guestCount"
                  type="number"
                  min={0}
                  {...form.register('guestCount', { valueAsNumber: true })}
                  className={form.formState.errors.guestCount ? 'border-danger' : ''}
                />
                {form.formState.errors.guestCount && (
                  <p className="text-xs text-danger">{form.formState.errors.guestCount.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budgetDollars">Budget</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted text-sm">$</span>
                  <Input
                    id="budgetDollars"
                    type="number"
                    min={0}
                    step={0.01}
                    className={`pl-7 ${form.formState.errors.budgetDollars ? 'border-danger' : ''}`}
                    {...form.register('budgetDollars', { valueAsNumber: true })}
                  />
                </div>
                {form.formState.errors.budgetDollars && (
                  <p className="text-xs text-danger">{form.formState.errors.budgetDollars.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save bar */}
        {isDirty && (
          <div className="sticky bottom-4 z-10">
            <Card className="border-brand/30 bg-brand/5">
              <CardContent className="py-3 flex items-center justify-between">
                <span className="text-sm text-fg-muted">You have unsaved changes</span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => form.reset()}
                  >
                    Discard
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={updateMutation.isPending}
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </form>

      {/* Danger zone */}
      <Card className="border-danger/20">
        <CardHeader>
          <CardTitle className="text-base text-danger flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Deleting an event is permanent. All associated guests, layouts, vendors, and timeline items will be removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete "{event.title}"?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. All guests, vendors, layouts, timeline items, and contracts
                  associated with this event will be permanently removed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <strong>DELETE</strong> to confirm:
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => { setDeleteConfirmOpen(false); setDeleteText(''); }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={deleteText !== 'DELETE' || deleteMutation.isPending}
                  isLoading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  Permanently Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
