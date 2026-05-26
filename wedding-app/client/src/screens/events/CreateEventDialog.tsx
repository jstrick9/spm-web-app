/**
 * CreateEventDialog — modal form to create a new event.
 *
 * Built on react-hook-form + zod for:
 *   - typed form state with auto-generated TypeScript types from the schema
 *   - field-level validation on blur + submit
 *   - clear error messaging at the field AND form level
 *
 * Calls sdk.events.create then invalidates the events query so the list
 * refreshes. On success, fires onCreated() so the caller can navigate to
 * the new event.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { sdk, ApiError } from '../../sdk';
import type { SdkEvent } from '../../sdk/types';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import {
  Form, FormControl, FormDescription, FormField,
  FormItem, FormLabel, FormMessage,
} from '../../ui/Form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/Select';
import { useToast } from '../../ui/Toast';
import { STATUS_META, statusOrder } from './statusMeta';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format');

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Too long'),
  status: z.enum(['lead','hold','booked','planning','completed','cancelled','lost']),
  startDate: isoDate.optional().or(z.literal('')),
  endDate:   isoDate.optional().or(z.literal('')),
  guestCount: z.preprocess(
    (v) => v === '' || v === undefined ? undefined : Number(v),
    z.number().int().min(0, 'Cannot be negative').optional(),
  ),
  budgetDollars: z.preprocess(
    (v) => v === '' || v === undefined ? undefined : Number(v),
    z.number().min(0, 'Cannot be negative').optional(),
  ),
}).refine(
  (d) => !d.startDate || !d.endDate || d.endDate >= d.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

type FormValues = z.infer<typeof schema>;

interface Props {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (event: SdkEvent) => void;
}

export function CreateEventDialog({ orgId, open, onOpenChange, onCreated }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      status: 'lead',
      startDate: '',
      endDate: '',
      guestCount: undefined,
      budgetDollars: undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await sdk.events.create({
        organizationId: orgId,
        title: values.title,
        status: values.status,
        startDate: values.startDate || undefined,
        endDate:   values.endDate   || undefined,
        guestCount: values.guestCount,
        budgetCents: values.budgetDollars !== undefined
          ? Math.round(values.budgetDollars * 100)
          : undefined,
      });
      return res.event;
    },
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: ['events', orgId] });
      toast({ title: 'Event created', description: event.title, variant: 'success' });
      form.reset();
      onOpenChange(false);
      onCreated?.(event);
    },
    onError: (err) => {
      const e = err as ApiError;
      toast({
        title: 'Could not create event',
        description:
          e.kind === 'forbidden' ? "You don't have permission to create events." :
          e.kind === 'validation' ? 'The form has errors. Check your input.' :
          e.message,
        variant: 'destructive',
      });
    },
  });

  function handleSubmit(values: FormValues) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!mutation.isPending) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>
            Set up a new wedding or event. You can add guests, vendors, and
            timeline details after.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Event title</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Smith and Jones Wedding" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOrder.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_META[s].label}
                          <span className="text-fg-subtle ml-1">— {STATUS_META[s].description}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>For multi-day events.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="guestCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected guests</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="120"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budgetDollars"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        placeholder="25000.00"
                        startSlot={<span className="text-fg-subtle">$</span>}
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={mutation.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={mutation.isPending}>
                Create event
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
