/**
 * GuestFormDialog — add OR edit a guest.
 *
 * One form, two modes:
 *   - "create" → POSTs to /api/events/:eventId/guests
 *   - "edit"   → PATCHes /api/guests/:id
 *
 * Form layer: react-hook-form + zod. Same patterns as CreateEventDialog.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError, sdk } from '../../../sdk';
import type { SdkGuest } from '../../../sdk/types';
import { Button } from '../../../ui/Button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../../ui/Dialog';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '../../../ui/Form';
import { Input } from '../../../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/Select';
import { Checkbox } from '../../../ui/Checkbox';
import { useToast } from '../../../ui/Toast';
import { RSVP_META, rsvpOrder } from './rsvpMeta';

const schema = z.object({
  fullName:             z.string().min(1, 'Name is required').max(200, 'Too long'),
  email:                z.string().email('Invalid email').optional().or(z.literal('')),
  phone:                z.string().max(40).optional().or(z.literal('')),
  partyName:            z.string().max(200).optional().or(z.literal('')),
  rsvpStatus:           z.enum(['pending','attending','declined','maybe']),
  tableAssignment:      z.string().max(60).optional().or(z.literal('')),
  dietaryRestrictions:  z.string().max(2000).optional().or(z.literal('')),
  accessibilityNotes:   z.string().max(2000).optional().or(z.literal('')),
  plusOneAllowed:       z.boolean(),
  allowPortalAccess:    z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  /** Pre-existing guest = "edit" mode; undefined = "create" mode. */
  guest?: SdkGuest;
  /** Required in create mode; ignored in edit mode (taken from guest). */
  eventId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (guest: SdkGuest) => void;
}

function defaultsFromGuest(g?: SdkGuest): FormValues {
  return {
    fullName:             g?.full_name ?? '',
    email:                g?.email ?? '',
    phone:                g?.phone ?? '',
    partyName:            g?.party_name ?? '',
    rsvpStatus:           g?.rsvp_status ?? 'pending',
    tableAssignment:      g?.table_assignment ?? '',
    dietaryRestrictions:  g?.dietary_restrictions ?? '',
    accessibilityNotes:   g?.accessibility_notes ?? '',
    plusOneAllowed:       g?.plus_one_allowed === 1,
    allowPortalAccess:    g?.allow_portal_access !== 0,
  };
}

export function GuestFormDialog({ guest, eventId, open, onOpenChange, onSaved }: Props) {
  const mode: 'create' | 'edit' = guest ? 'edit' : 'create';
  const qc = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFromGuest(guest),
  });

  // Reset the form whenever we open or whenever the target guest changes
  useEffect(() => {
    if (open) form.reset(defaultsFromGuest(guest));
  }, [open, guest, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues): Promise<SdkGuest> => {
      const payload = {
        fullName:             values.fullName,
        email:                values.email || undefined,
        phone:                values.phone || undefined,
        partyName:            values.partyName || undefined,
        rsvpStatus:           values.rsvpStatus,
        tableAssignment:      values.tableAssignment || undefined,
        dietaryRestrictions:  values.dietaryRestrictions || undefined,
        accessibilityNotes:   values.accessibilityNotes || undefined,
        plusOneAllowed:       values.plusOneAllowed,
        allowPortalAccess:    values.allowPortalAccess,
      };
      if (mode === 'edit' && guest) {
        const res = await sdk.guests.update(guest.id, payload);
        return res.guest;
      }
      if (!eventId) throw new Error('eventId is required in create mode');
      const res = await sdk.guests.create(eventId, payload);
      return res.guest;
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['guests', saved.event_id] });
      qc.invalidateQueries({ queryKey: ['guests-counts', saved.event_id] });
      toast({
        title: mode === 'edit' ? 'Guest updated' : 'Guest added',
        description: saved.full_name,
        variant: 'success',
      });
      form.reset();
      onOpenChange(false);
      onSaved?.(saved);
    },
    onError: (err) => {
      const e = err as ApiError;
      toast({
        title: mode === 'edit' ? 'Could not update guest' : 'Could not add guest',
        description:
          e.kind === 'forbidden' ? "You don't have permission to manage guests." :
          e.kind === 'validation' ? 'The form has errors. Check your input.' :
          e.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!mutation.isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit guest' : 'Add guest'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? `Update ${guest?.full_name}'s information and RSVP status.`
              : 'Add a guest to this event. You can update their RSVP later or wait for them to RSVP via the portal.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="grid gap-4"
          >
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Full name</FormLabel>
                  <FormControl><Input {...field} autoFocus /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="text" inputMode="email" autoComplete="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input type="tel" inputMode="tel" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="partyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Party / household</FormLabel>
                    <FormControl><Input {...field} placeholder="Smith family" /></FormControl>
                    <FormDescription>Group guests who travel together.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rsvpStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RSVP status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {rsvpOrder.map((s) => (
                          <SelectItem key={s} value={s}>
                            {RSVP_META[s].label}
                            <span className="ml-1 text-fg-subtle">— {RSVP_META[s].description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tableAssignment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Table</FormLabel>
                  <FormControl><Input {...field} placeholder="Table 3 / Head table / Sweetheart" /></FormControl>
                  <FormDescription>Free-text for now. Drag-drop assignment lands with the Floor Plan canvas in Week 2.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dietaryRestrictions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dietary restrictions</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={2}
                      className="flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                      placeholder="Vegan, gluten-free, peanut allergy…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accessibilityNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Accessibility notes</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={2}
                      className="flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                      placeholder="Wheelchair access, ASL interpreter needed…"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2 rounded-md border border-border bg-surface-2/40 p-4">
              <FormField
                control={form.control}
                name="plusOneAllowed"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="cursor-pointer">Plus-one allowed</FormLabel>
                      <FormDescription>Guest can bring a +1.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="allowPortalAccess"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(v) => field.onChange(v === true)}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="cursor-pointer">Allow portal access</FormLabel>
                      <FormDescription>Guest can RSVP via the public portal.</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-2">
              <Button
                type="button" variant="ghost"
                disabled={mutation.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={mutation.isPending}>
                {mode === 'edit' ? 'Save changes' : 'Add guest'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
