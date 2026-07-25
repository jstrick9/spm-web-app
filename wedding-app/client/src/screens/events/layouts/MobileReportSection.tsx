export function MobileReportSection({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-fg-subtle">{title}</h4>
      <div className="space-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-border/40 py-1 last:border-0">
            <span className="text-fg-muted">{label}</span>
            <strong className="text-right text-fg">{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
