export function MiniLayoutMetric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-lg border border-border bg-surface-2 p-2"><div className="text-[10px] uppercase font-bold text-fg-subtle">{label}</div><div className="text-lg font-bold text-brand">{value}</div><div className="text-[11px] text-fg-muted">{detail}</div></div>;
}
