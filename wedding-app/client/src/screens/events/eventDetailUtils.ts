export type EventRsvpCounts = { pending: number; attending: number; declined: number; maybe: number };
export function safeMetadata(raw: string | null | undefined): Record<string, any> {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

export function eventSetupItems(
  event: any,
  counts?: EventRsvpCounts,
) {
  const metadata = safeMetadata(event.metadata);
  const metadataChecklist = Array.isArray(metadata.setupChecklist)
    ? metadata.setupChecklist
    : [];
  const base = [
    {
      id: "required_fields",
      label: "Required event fields",
      done: Boolean(event.title && event.status),
    },
    {
      id: "date_confirmed",
      label: "Event date confirmed",
      done: Boolean(event.start_date),
    },
    {
      id: "guest_count",
      label: "Expected guest count set",
      done: Number(event.guest_count) > 0,
    },
    {
      id: "budget_or_quote",
      label: "Budget/quote captured",
      done: Boolean(event.budget_cents || metadata.quoteCents),
    },
    {
      id: "lead_source",
      label: "Lead source attributed",
      done: Boolean(
        (event as any).lead_source ||
        metadata.leadSource ||
        ["booked", "planning", "completed"].includes(event.status),
      ),
    },
    {
      id: "follow_up",
      label: "Follow-up/proposal milestone set",
      done: Boolean(
        metadata.followUpDate ||
        metadata.proposalDueDate ||
        !["lead", "hold"].includes(event.status),
      ),
    },
    {
      id: "payment",
      label: "Contract/payment milestone set",
      done: Boolean(
        metadata.depositDueDate ||
        ["lead", "hold", "lost", "cancelled"].includes(event.status),
      ),
    },
    {
      id: "guests",
      label: "Guest list started",
      done: Boolean(
        counts &&
        counts.pending + counts.attending + counts.declined + counts.maybe > 0,
      ),
    },
    ...metadataChecklist.map((i: any) => ({
      id: String(i.id),
      label: String(i.label),
      done: Boolean(i.done),
    })),
  ];
  const unique = new Map<
    string,
    { id: string; label: string; done: boolean }
  >();
  for (const item of base) unique.set(item.id, item);
  return Array.from(unique.values());
}

export function eventReadinessScore(
  event: any,
  counts?: EventRsvpCounts,
) {
  const items = eventSetupItems(event, counts);
  return items.length
    ? Math.round((items.filter((i) => i.done).length / items.length) * 100)
    : 0;
}
