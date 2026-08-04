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
  insuranceRequirements: z.string().optional(),
  loadInRoute: z.string().optional(),
  documentsText: z.string().optional(),
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
      insuranceRequirements: parsedMeta.insuranceRequirements || 'General liability COI required; venue named as additional insured.',
      loadInRoute: parsedMeta.loadInRoute || '',
      documentsText: Array.isArray(parsedMeta.documents) ? parsedMeta.documents.map((d: any) => `${d.name}|${d.url}`).join('\n') : '',
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
        insuranceRequirements: meta.insuranceRequirements || 'General liability COI required; venue named as additional insured.',
        loadInRoute: meta.loadInRoute || '',
        documentsText: Array.isArray(meta.documents) ? meta.documents.map((d: any) => `${d.name}|${d.url}`).join('\n') : '',
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
        insuranceRequirements: 'General liability COI required; venue named as additional insured.',
        loadInRoute: '',
        documentsText: '',
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

      const documents = (values.documentsText || '').split('\n').map(line => line.trim()).filter(Boolean).map((line, index) => {
        const [name, url] = line.split('|');
        return { id: `doc-${index}`, name: name?.trim() || `Document ${index + 1}`, url: url?.trim() || name?.trim() };
      });

      const meta = {
        ...parsedMeta,
        coiReceived: values.coiReceived,
        coiInsurer: values.coiInsurer || undefined,
        coiPolicyNumber: values.coiPolicyNumber || undefined,
        coiExpirationDate: values.coiExpirationDate || undefined,
        coiCoverageAmount: values.coiCoverageAmountStr || undefined,
        insuranceRequirements: values.insuranceRequirements || undefined,
        loadInRoute: values.loadInRoute || undefined,
        documents,
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-paper border border-paper-border rounded-2xl shadow-xl">
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
                  <FormControl><Input {...field} autoFocus className="bg-white border-paper-border h-9 text-xs" /></FormControl>
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
                      <FormControl><select {...field} className="bg-white border border-paper-border h-9 text-xs rounded-md px-2 w-full"><option value="">Select template</option><option value="catering">Catering</option><option value="florals">Florals</option><option value="photography">Photography</option><option value="entertainment">DJ / Entertainment</option><option value="rentals">Rentals</option><option value="transportation">Transportation</option><option value="officiant">Officiant</option><option value="other">Other</option></select></FormControl>
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
                      <FormControl><Input placeholder="$0.00" {...field} className="bg-white border-paper-border h-9 text-xs" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>

            <div className="space-y-3 pt-2 border-t border-paper-border/40">
               <h4 className="text-xs font-bold text-fg uppercase tracking-wider font-serif">Contact Information</h4>
               
               <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Primary Contact Name</FormLabel>
                      <FormControl><Input {...field} className="bg-white border-paper-border h-9 text-xs" /></FormControl>
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
                          <FormControl><Input type="email" {...field} className="bg-white border-paper-border h-9 text-xs" /></FormControl>
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
                          <FormControl><Input type="tel" {...field} className="bg-white border-paper-border h-9 text-xs" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
            </div>

            {/* Certificate of Insurance (COI) Compliance Form Panel */}
            <div className="space-y-3 pt-4 border-t border-paper-border bg-white p-4 rounded-xl border">
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
                          className="rounded border-paper-border text-brand focus:ring-brand h-4 w-4 cursor-pointer" 
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
                          <FormControl><Input placeholder="e.g. Liberty Mutual" {...field} className="bg-white border-paper-border h-8 text-xs" /></FormControl>
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
                          <FormControl><Input placeholder="e.g. GL-9102831" {...field} className="bg-white border-paper-border h-8 text-xs" /></FormControl>
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
                          <FormControl><Input type="date" {...field} className="bg-white border-paper-border h-8 text-xs" /></FormControl>
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
                          <FormControl><Input placeholder="e.g. $1,000,000" {...field} className="bg-white border-paper-border h-8 text-xs" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-paper-border bg-white p-4 rounded-xl border">
              <h4 className="text-xs font-bold uppercase tracking-wider font-serif text-brand">Vendor requirements, route & document vault</h4>
              <FormField control={form.control} name="insuranceRequirements" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] text-fg-subtle">Insurance requirements configuration</FormLabel><FormControl><textarea {...field} rows={2} className="w-full rounded-md border border-paper-border bg-white p-2 text-xs" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="loadInRoute" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] text-fg-subtle">Arrival / load-in route planner</FormLabel><FormControl><Input placeholder="e.g. Use north gate, loading dock B, no guest driveway" {...field} className="bg-white border-paper-border h-8 text-xs" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="documentsText" render={({ field }) => (
                <FormItem><FormLabel className="text-[10px] text-fg-subtle">Vendor document vault (one per line: Name|URL)</FormLabel><FormControl><textarea {...field} rows={3} className="w-full rounded-md border border-paper-border bg-white p-2 text-xs" placeholder="Contract packet|https://..." /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <DialogFooter className="pt-4 mt-2 border-t border-paper-border">
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
