/**
 * CreateEventDialog — guided event creation for venue owners.
 * Separates required booking fields from optional planning details and provides
 * smart templates/defaults for common venue workflows.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { sdk, ApiError } from "../../sdk";
import type { SdkEvent } from "../../sdk/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/Dialog";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../ui/Form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/Select";
import { useToast } from "../../ui/Toast";
import { STATUS_META, statusOrder } from "./statusMeta";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format");
const eventTypes = [
  "wedding",
  "rehearsal_dinner",
  "corporate_private",
  "styled_shoot",
  "tour",
  "tasting",
  "rehearsal",
  "setup_day",
  "cleanup_day",
] as const;
const leadSources = [
  "website",
  "referral",
  "the_knot",
  "weddingwire",
  "facebook",
  "instagram",
  "google",
  "walk_in",
  "other",
  "",
] as const;

const schema = z
  .object({
    eventType: z.enum(eventTypes),
    cloneFromEventId: z.string().optional(),
    title: z.string().min(1, "Title is required").max(200, "Too long"),
    status: z.enum([
      "lead",
      "hold",
      "booked",
      "planning",
      "completed",
      "cancelled",
      "lost",
    ]),
    operationalStatus: z
      .enum([
        "sales_owned",
        "handoff_needed",
        "manager_assigned",
        "event_week",
        "day_of",
        "closeout",
      ])
      .optional(),
    startDate: isoDate.optional().or(z.literal("")),
    endDate: isoDate.optional().or(z.literal("")),
    guestCount: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : Number(v)),
      z.number().int().min(0, "Cannot be negative").optional(),
    ),
    leadSource: z.enum(leadSources).optional(),
    tourDate: isoDate.optional().or(z.literal("")),
    proposalDueDate: isoDate.optional().or(z.literal("")),
    followUpDate: isoDate.optional().or(z.literal("")),
    rsvpDeadline: isoDate.optional().or(z.literal("")),
    depositDueDate: isoDate.optional().or(z.literal("")),
    quoteDollars: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : Number(v)),
      z.number().min(0).optional(),
    ),
    budgetDollars: z.preprocess(
      (v) => (v === "" || v === undefined ? undefined : Number(v)),
      z.number().min(0, "Cannot be negative").optional(),
    ),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (event: SdkEvent) => void;
}

const TEMPLATE_DEFAULTS: Record<
  FormValues["eventType"],
  Partial<FormValues> & { label: string; description: string }
> = {
  wedding: {
    label: "Wedding",
    description:
      "Full ceremony/reception workflow with portals, vendors, timeline, layout, contract, and payments.",
    status: "lead",
    guestCount: 120,
  },
  rehearsal_dinner: {
    label: "Rehearsal dinner",
    description:
      "Smaller pre-wedding event with dining, timeline, and limited vendor needs.",
    status: "planning",
    guestCount: 40,
  },
  corporate_private: {
    label: "Corporate/private event",
    description:
      "Private rental, fundraiser, meeting, retreat, or non-wedding event.",
    status: "lead",
    guestCount: 75,
  },
  styled_shoot: {
    label: "Styled shoot",
    description:
      "Vendor collaboration or marketing shoot with lightweight guest and payment needs.",
    status: "planning",
    guestCount: 12,
  },
  tour: {
    label: "Venue tour",
    description:
      "Manager workflow for tours, walkthroughs, availability review, and owner follow-up.",
    status: "lead",
    guestCount: 2,
  },
  tasting: {
    label: "Tasting",
    description:
      "Operations template for tasting events, catering coordination, and client experience.",
    status: "planning",
    guestCount: 8,
  },
  rehearsal: {
    label: "Rehearsal",
    description:
      "Short operations template for ceremony rehearsal, family arrivals, and planner coordination.",
    status: "planning",
    guestCount: 30,
  },
  setup_day: {
    label: "Setup day",
    description:
      "Internal operations day for rentals, layout verification, load-in, and staff assignments.",
    status: "planning",
    guestCount: 0,
  },
  cleanup_day: {
    label: "Cleanup day",
    description:
      "Post-event strike, lost-and-found, damage walkthrough, and venue reset workflow.",
    status: "completed",
    guestCount: 0,
  },
};

export function CreateEventDialog({
  orgId,
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const configQuery = useQuery({
    queryKey: ["org-config", orgId, "event-defaults"],
    queryFn: () => sdk.platformConfig.getOrg(orgId),
    enabled: open,
    staleTime: 60_000,
  });

  const templatesQuery = useQuery({
    queryKey: ["events", orgId, "clone-templates"],
    queryFn: () => sdk.events.list(orgId, { limit: 50 }),
    enabled: open,
    staleTime: 60_000,
  });

  const venueCapacity =
    Number(
      (configQuery.data?.config as any)?.setup?.ownerSetup?.rules
        ?.maxSeatedCapacity,
    ) || undefined;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      eventType: "wedding",
      cloneFromEventId: "",
      title: "",
      status: "lead",
      operationalStatus: "sales_owned",
      startDate: "",
      endDate: "",
      guestCount: undefined,
      leadSource: "",
      tourDate: "",
      proposalDueDate: "",
      followUpDate: "",
      rsvpDeadline: "",
      depositDueDate: "",
      quoteDollars: undefined,
      budgetDollars: undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    const currentType = form.getValues("eventType");
    const defaults = TEMPLATE_DEFAULTS[currentType];
    if (
      !form.getValues("guestCount") &&
      (venueCapacity || defaults.guestCount)
    ) {
      form.setValue(
        "guestCount",
        Math.min(venueCapacity ?? defaults.guestCount!, defaults.guestCount!),
      );
    }
  }, [open, venueCapacity]);

  function applyTemplate(type: FormValues["eventType"]) {
    const defaults = TEMPLATE_DEFAULTS[type];
    form.setValue("eventType", type);
    form.setValue("status", defaults.status ?? "lead");
    form.setValue(
      "operationalStatus",
      ["booked", "planning", "completed"].includes(defaults.status ?? "lead")
        ? "handoff_needed"
        : "sales_owned",
    );
    form.setValue(
      "guestCount",
      Math.min(
        venueCapacity ?? defaults.guestCount ?? 0,
        defaults.guestCount ?? venueCapacity ?? 0,
      ),
    );
  }

  function applyClone(eventId: string) {
    form.setValue("cloneFromEventId", eventId);
    const event = templatesQuery.data?.events.find((e) => e.id === eventId);
    if (!event) return;
    form.setValue("title", `${event.title} Copy`);
    form.setValue("status", "lead");
    form.setValue("guestCount", event.guest_count || undefined);
    form.setValue(
      "budgetDollars",
      event.budget_cents ? event.budget_cents / 100 : undefined,
    );
    try {
      const metadata = JSON.parse(event.metadata || "{}");
      if (metadata.eventType && eventTypes.includes(metadata.eventType))
        form.setValue("eventType", metadata.eventType);
    } catch {
      /* ignore */
    }
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const metadata = {
        eventType: values.eventType,
        cloneFromEventId: values.cloneFromEventId || undefined,
        operationalStatus:
          values.operationalStatus ||
          (["booked", "planning"].includes(values.status)
            ? "handoff_needed"
            : values.status === "completed"
              ? "closeout"
              : "sales_owned"),
        eventComplexity: estimateCreateEventComplexity(values),
        salesToOperationsHandoff: defaultHandoffChecklist(values),
        managerWarning:
          values.operationalStatus === "handoff_needed"
            ? "Manager should verify owner/admin approvals before accepting operational ownership."
            : undefined,
        tourDate: values.tourDate || undefined,
        proposalDueDate: values.proposalDueDate || undefined,
        followUpDate: values.followUpDate || undefined,
        depositDueDate: values.depositDueDate || undefined,
        quoteCents:
          values.quoteDollars !== undefined
            ? Math.round(values.quoteDollars * 100)
            : undefined,
        setupChecklist: defaultEventChecklist(values.eventType, values.status),
      };
      const res = await sdk.events.create({
        organizationId: orgId,
        title: values.title,
        status: values.status,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        guestCount: values.guestCount,
        budgetCents:
          values.budgetDollars !== undefined
            ? Math.round(values.budgetDollars * 100)
            : undefined,
        leadSource: values.leadSource || undefined,
        rsvpDeadline: values.rsvpDeadline || undefined,
        metadata,
      });
      return res.event;
    },
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: ["events", orgId] });
      toast({
        title: "Event created",
        description: event.title,
        variant: "success",
      });
      form.reset();
      onOpenChange(false);
      onCreated?.(event);
    },
    onError: (err) => {
      const e = err as ApiError;
      toast({
        title: "Could not create event",
        description:
          e.kind === "forbidden"
            ? "You don't have permission to create events."
            : e.kind === "validation"
              ? "The form has errors. Check your input."
              : e.message,
        variant: "destructive",
      });
    },
  });

  function handleSubmit(values: FormValues) {
    mutation.mutate(values);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!mutation.isPending) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>
            Start with required booking fields, then add optional planning
            details for pipeline, quote, follow-up, contract, and payment
            milestones.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="grid gap-5"
          >
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-fg">
                  Choose an event template
                </h3>
                <p className="text-xs text-fg-muted">
                  Templates apply smart defaults based on event type and venue
                  setup.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  Object.keys(TEMPLATE_DEFAULTS) as FormValues["eventType"][]
                ).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => applyTemplate(type)}
                    className={`rounded-lg border p-3 text-left text-xs ${form.watch("eventType") === type ? "border-brand bg-brand-soft/50" : "border-border bg-surface-2 hover:bg-surface-3"}`}
                  >
                    <span className="block font-bold text-fg">
                      {TEMPLATE_DEFAULTS[type].label}
                    </span>
                    <span className="mt-1 block text-fg-muted leading-relaxed">
                      {TEMPLATE_DEFAULTS[type].description}
                    </span>
                  </button>
                ))}
              </div>
              {(templatesQuery.data?.events?.length ?? 0) > 0 && (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end rounded-lg border border-border bg-surface-2 p-3">
                  <FormField
                    control={form.control}
                    name="cloneFromEventId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Clone from existing event/template
                        </FormLabel>
                        <Select
                          value={field.value || ""}
                          onValueChange={(v) => applyClone(v)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an event to copy details from" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {templatesQuery.data!.events.map((e) => (
                              <SelectItem key={e.id} value={e.id}>
                                {e.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <span className="text-[11px] text-fg-muted pb-2">
                    Copies guest count, budget, and event type; dates stay
                    editable.
                  </span>
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-xl border border-border p-4">
              <h3 className="text-sm font-bold text-fg">Required fields</h3>
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Event title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Smith and Jones Wedding"
                        autoFocus
                      />
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
                            <span className="text-fg-subtle ml-1">
                              — {STATUS_META[s].ownerDefinition}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {STATUS_META[field.value].nextStep}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="operationalStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manager operational status</FormLabel>
                    <Select
                      value={field.value || "sales_owned"}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick operational stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sales_owned">
                          Sales/owner-owned
                        </SelectItem>
                        <SelectItem value="handoff_needed">
                          Handoff needed
                        </SelectItem>
                        <SelectItem value="manager_assigned">
                          Manager assigned
                        </SelectItem>
                        <SelectItem value="event_week">
                          Event-week readiness
                        </SelectItem>
                        <SelectItem value="day_of">
                          Day-of operations
                        </SelectItem>
                        <SelectItem value="closeout">
                          Post-event closeout
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Separate operational ownership from the sales pipeline
                      status.
                    </FormDescription>
                  </FormItem>
                )}
              />
              {["booked", "planning"].includes(form.watch("status")) && (
                <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning">
                  Manager warning: verify owner approval, contract/deposit
                  context, guest count/date, and planning handoff before
                  accepting operational ownership.
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-xl border border-border p-4 bg-surface-2/40">
              <h3 className="text-sm font-bold text-fg">
                Optional planning details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField form={form} name="startDate" label="Start date" />
                <DateField
                  form={form}
                  name="endDate"
                  label="End date"
                  description="For multi-day events."
                />
                <NumberField
                  form={form}
                  name="guestCount"
                  label="Expected guests"
                  placeholder={
                    venueCapacity ? String(Math.min(venueCapacity, 120)) : "120"
                  }
                />
                <MoneyField
                  form={form}
                  name="budgetDollars"
                  label="Budget"
                  placeholder="25000.00"
                />
                <FormField
                  control={form.control}
                  name="leadSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead source attribution</FormLabel>
                      <Select
                        value={field.value || ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Where did this inquiry come from?" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leadSources.filter(Boolean).map((s) => (
                            <SelectItem key={s} value={s}>
                              {String(s).replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DateField form={form} name="tourDate" label="Tour date" />
                <DateField
                  form={form}
                  name="proposalDueDate"
                  label="Proposal / quote due"
                />
                <DateField
                  form={form}
                  name="followUpDate"
                  label="Follow-up reminder"
                />
                <DateField
                  form={form}
                  name="rsvpDeadline"
                  label="RSVP deadline"
                />
                <DateField
                  form={form}
                  name="depositDueDate"
                  label="Deposit/payment due"
                />
                <MoneyField
                  form={form}
                  name="quoteDollars"
                  label="Quote amount"
                  placeholder="15000.00"
                />
              </div>
            </section>

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

function DateField({
  form,
  name,
  label,
  description,
}: {
  form: any;
  name: keyof FormValues;
  label: string;
  description?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type="date" {...field} />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
function NumberField({
  form,
  name,
  label,
  placeholder,
}: {
  form: any;
  name: keyof FormValues;
  label: string;
  placeholder?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={placeholder}
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
function MoneyField({
  form,
  name,
  label,
  placeholder,
}: {
  form: any;
  name: keyof FormValues;
  label: string;
  placeholder?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder={placeholder}
              startSlot={<span className="text-fg-subtle">$</span>}
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function estimateCreateEventComplexity(values: FormValues) {
  const guestCount = Number(values.guestCount || 0);
  const score = Math.min(
    100,
    15 +
      Math.ceil(guestCount / 4) +
      (values.eventType === "wedding"
        ? 20
        : values.eventType === "setup_day" || values.eventType === "cleanup_day"
          ? 12
          : 8) +
      (values.budgetDollars ? 10 : 0) +
      (values.depositDueDate ? 8 : 0) +
      (values.rsvpDeadline ? 8 : 0),
  );
  const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  return {
    score,
    level,
    reasons: [
      guestCount ? `${guestCount} guests` : "guest count missing",
      values.eventType,
      values.budgetDollars ? "budget provided" : "budget missing",
    ],
  };
}

function defaultHandoffChecklist(values: FormValues) {
  return [
    {
      id: "owner_approval",
      label: "Owner/admin approved operational handoff",
      done: !["booked", "planning"].includes(values.status),
    },
    {
      id: "date_guest_count",
      label: "Date and guest count confirmed",
      done: Boolean(values.startDate && values.guestCount !== undefined),
    },
    {
      id: "contract_payment_context",
      label: "Contract/payment context known",
      done: Boolean(
        values.depositDueDate || values.budgetDollars || values.quoteDollars,
      ),
    },
    {
      id: "manager_operational_stage",
      label: "Manager operational stage selected",
      done: Boolean(
        values.operationalStatus && values.operationalStatus !== "sales_owned",
      ),
    },
  ];
}

function defaultEventChecklist(
  eventType: FormValues["eventType"],
  status: FormValues["status"],
) {
  const base = [
    { id: "required_fields", label: "Required event fields", done: true },
    { id: "date_confirmed", label: "Date confirmed", done: false },
    {
      id: "contract_milestone",
      label: "Contract milestone set",
      done: ["booked", "planning", "completed"].includes(status),
    },
    {
      id: "payment_milestone",
      label: "Deposit/payment milestone set",
      done: false,
    },
    {
      id: "guest_portal",
      label: "Guest portal configured",
      done: eventType === "styled_shoot",
    },
    { id: "vendor_portal", label: "Vendor portal configured", done: false },
    { id: "timeline", label: "Timeline/run sheet started", done: false },
    {
      id: "layout",
      label: "Layout/floorplan started",
      done: eventType === "styled_shoot",
    },
  ];
  return base;
}
