import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/Dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '../../../ui/Form';
import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';
import { useToast } from '../../../ui/Toast';
import { vendorsSdk } from '../../../sdk/vendors';
import { SdkVendor } from '../../../sdk/types';

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
  // COI Sub-fields (stored in metadata)
  coiReceived: z.boolean().default(false),
  coiInsurer: z.string().optional(),
  coiPolicyNumber: z.string().optional(),
  coiExpirationDate: z.string().optional(),
  coiCoverageAmountStr: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  organizationId: string;
  vendor?: SdkVendor | null; // Optional: supporting edit mode!
}

export function VendorFormDialog({ open, onOpenChange, eventId, organizationId, vendor }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!vendor;

  const parsedMeta = typeof vendor?.metadata === 'string' ? JSON.parse(vendor.metadata || '{}') : (vendor?.metadata || {});

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: vendor?.name || '',
      category: vendor?.category || '',
      contactName: vendor?.contact_name || '',
      email: vendor?.email || '',
      phone: vendor?.phone || '',
      websiteUrl: vendor?.website_url || '',
      contractAmountStr: vendor?.contract_amount_cents ? (vendor.contract_amount_cents / 100).toString() : '',
      isPreferred: vendor?.is_preferred === 1,
      notes: vendor?.notes || '',
      coiReceived: parsedMeta.coiReceived ?? false,
      coiInsurer: parsedMeta.coiInsurer || '',
      coiPolicyNumber: parsedMeta.coiPolicyNumber || '',
      coiExpirationDate: parsedMeta.coiExpirationDate || '',
      coiCoverageAmountStr: parsedMeta.coiCoverageAmount || '',
    },
  });

  useEffect(() => {
    if (vendor) {
      const meta = typeof vendor.metadata === 'string' ? JSON.parse(vendor.metadata || '{}') : (vendor.metadata || {});
      form.reset({
        name: vendor.name,
        category: vendor.category,
        contactName: vendor.contact_name || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        websiteUrl: vendor.website_url || '',
        contractAmountStr: vendor.contract_amount_cents ? (vendor.contract_amount_cents / 100).toString() : '',
        isPreferred: vendor.is_preferred === 1,
        notes: vendor.notes || '',
        coiReceived: meta.coiReceived ?? false,
        coiInsurer: meta.coiInsurer || '',
        coiPolicyNumber: meta.coiPolicyNumber || '',
        coiExpirationDate: meta.coiExpirationDate || '',
        coiCoverageAmountStr: meta.coiCoverageAmount || '',
      });
    } else {
      form.reset({
        name: '',
        category: '',
        contactName: '',
        email: '',
        phone: '',
        websiteUrl: '',
        contractAmountStr: '',
        isPreferred: false,
        notes: '',
        coiReceived: false,
        coiInsurer: '',
        coiPolicyNumber: '',
        coiExpirationDate: '',
        coiCoverageAmountStr: '',
      });
    }
  }, [vendor, form, open]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      let contractAmountCents = undefined;
      if (values.contractAmountStr) {
        const parsed = parseFloat(values.contractAmountStr.replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed)) {
          contractAmountCents = Math.round(parsed * 100);
        }
      }

      const meta = {
        ...parsedMeta,
        coiReceived: values.coiReceived,
        coiInsurer: values.coiInsurer || undefined,
        coiPolicyNumber: values.coiPolicyNumber || undefined,
        coiExpirationDate: values.coiExpirationDate || undefined,
        coiCoverageAmount: values.coiCoverageAmountStr || undefined,
      };

      const payload = {
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
        metadata: meta,
      };

      if (isEdit) {
        return vendorsSdk.update(vendor.id, payload);
      } else {
        return vendorsSdk.create(organizationId, payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors', eventId] });
      toast({ title: isEdit ? 'Vendor details updated' : 'Vendor added successfully', variant: 'success' });
      onOpenChange(false);
      form.reset();
    },
    onError: (e: any) => {
      toast({ title: 'Failed to save vendor details', description: e.message, variant: 'destructive' });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-[#FDFBF7] border border-[#e1d5c9] rounded-2xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="font-serif font-bold text-xl text-fg">{isEdit ? 'Edit Vendor Details' : 'Add New Vendor'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4 font-semibold text-xs text-fg">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Company / Vendor Name *</FormLabel>
                  <FormControl><Input {...field} autoFocus className="bg-white border-[#e1d5c9] h-9 text-xs" /></FormControl>
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
                      <FormLabel className="text-xs">Category</FormLabel>
                      <FormControl><Input placeholder="e.g. Florist, Photographer" {...field} className="bg-white border-[#e1d5c9] h-9 text-xs" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contractAmountStr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Contract Amount</FormLabel>
                      <FormControl><Input placeholder="$0.00" {...field} className="bg-white border-[#e1d5c9] h-9 text-xs" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <div className="space-y-3 pt-2 border-t border-[#e1d5c9]/40">
               <h4 className="text-xs font-bold text-fg uppercase tracking-wider font-serif">Contact Information</h4>
               
               <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Primary Contact Name</FormLabel>
                      <FormControl><Input {...field} className="bg-white border-[#e1d5c9] h-9 text-xs" /></FormControl>
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
                          <FormLabel className="text-xs">Email Address</FormLabel>
                          <FormControl><Input type="email" {...field} className="bg-white border-[#e1d5c9] h-9 text-xs" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Phone Number</FormLabel>
                          <FormControl><Input type="tel" {...field} className="bg-white border-[#e1d5c9] h-9 text-xs" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
            </div>

            {/* Certificate of Insurance (COI) Compliance Form Panel */}
            <div className="space-y-3 pt-4 border-t border-[#e1d5c9] bg-white p-4 rounded-xl border">
               <h4 className="text-xs font-bold text-fg uppercase tracking-wider font-serif text-brand flex items-center gap-1.5">
                  🛡️ Certificate of Insurance (COI)
               </h4>
               
               <FormField
                  control={form.control}
                  name="coiReceived"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <input 
                          type="checkbox" 
                          checked={field.value} 
                          onChange={field.onChange} 
                          className="rounded border-[#e1d5c9] text-brand focus:ring-brand h-4 w-4 cursor-pointer" 
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer text-xs font-semibold text-fg">COI Document Received &amp; Verified</FormLabel>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3 pt-1">
                   <FormField
                      control={form.control}
                      name="coiInsurer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] text-fg-subtle">Insurer / Carrier Name</FormLabel>
                          <FormControl><Input placeholder="e.g. Liberty Mutual" {...field} className="bg-white border-[#e1d5c9] h-8 text-xs" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="coiPolicyNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] text-fg-subtle">Policy Number</FormLabel>
                          <FormControl><Input placeholder="e.g. GL-9102831" {...field} className="bg-white border-[#e1d5c9] h-8 text-xs" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="coiExpirationDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] text-fg-subtle">Policy Expiration Date</FormLabel>
                          <FormControl><Input type="date" {...field} className="bg-white border-[#e1d5c9] h-8 text-xs" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="coiCoverageAmountStr"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[10px] text-fg-subtle">General Liability Limit</FormLabel>
                          <FormControl><Input placeholder="e.g. $1,000,000" {...field} className="bg-white border-[#e1d5c9] h-8 text-xs" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
            </div>

            <DialogFooter className="pt-4 mt-2 border-t border-[#e1d5c9]">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Vendor'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
