import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/Dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '../../../ui/Form';
import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';
import { useToast } from '../../../ui/Toast';
import { vendorsSdk } from '../../../sdk/vendors';

const formSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  category: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  websiteUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  contractAmountStr: z.string().optional(),
  isPreferred: z.boolean().default(false),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  organizationId: string;
}

export function VendorFormDialog({ open, onOpenChange, eventId, organizationId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      category: '',
      contactName: '',
      email: '',
      phone: '',
      websiteUrl: '',
      contractAmountStr: '',
      isPreferred: false,
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      let contractAmountCents = undefined;
      if (values.contractAmountStr) {
        const parsed = parseFloat(values.contractAmountStr.replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed)) {
          contractAmountCents = Math.round(parsed * 100);
        }
      }

      return vendorsSdk.create(organizationId, {
        name: values.name,
        eventId,
        category: values.category,
        contactName: values.contactName,
        email: values.email || undefined,
        phone: values.phone,
        websiteUrl: values.websiteUrl || undefined,
        contractAmountCents,
        isPreferred: values.isPreferred,
        notes: values.notes,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors', eventId] });
      toast({ title: 'Vendor added successfully', variant: 'success' });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({ title: 'Failed to add vendor', description: e.message, variant: 'destructive' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Vendor</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company / Vendor Name *</FormLabel>
                  <FormControl><Input {...field} autoFocus /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
               <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl><Input placeholder="e.g. Florist, Photographer" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contractAmountStr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Amount</FormLabel>
                      <FormControl><Input placeholder="$0.00" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <div className="space-y-4 pt-2 border-t">
               <h4 className="text-sm font-medium text-fg">Contact Information</h4>
               
               <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Contact Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                   <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl><Input type="email" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl><Input type="tel" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
            </div>

            <DialogFooter className="pt-4 mt-2 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : 'Add Vendor'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
