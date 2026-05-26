/**
 * WidgetSlot — the consumer of the widget config.
 *
 *   <WidgetSlot id="venue.dashboard.kpis" />
 *
 * Renders the configured widgets in order, with a default grid layout.
 * Widgets not found in the registry render a quiet fallback (logged to
 * console so admins see warnings in dev).
 */
import { useWidgetSlot } from '../ConfigProvider.js';
import { getWidget } from './registry.js';
import { cn } from '../../ui/lib/cn.js';

const SIZE_CLASS = {
  sm: 'lg:col-span-3',
  md: 'lg:col-span-6',
  lg: 'lg:col-span-8',
  xl: 'lg:col-span-12',
} as const;

export interface WidgetSlotProps {
  id: string;
  /** Optional event id passed down to widgets that need it. */
  eventId?: string;
  /** Optional org id passed down to widgets that need it. */
  orgId?: string;
  className?: string;
}

export function WidgetSlot({ id, eventId, orgId, className }: WidgetSlotProps) {
  const entries = useWidgetSlot(id);
  if (entries.length === 0) return null;

  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-12', className)}>
      {entries.map((entry, i) => {
        const def = getWidget(entry.id);
        if (!def) {
          if (typeof console !== 'undefined') {
            console.warn(`[WidgetSlot ${id}] unknown widget "${entry.id}" — skipping.`);
          }
          return null;
        }
        const Comp = def.Component;
        return (
          <div key={`${entry.id}-${i}`} className={cn('col-span-1', SIZE_CLASS[def.defaultSize])}>
            <Comp options={entry.options} eventId={eventId} orgId={orgId} />
          </div>
        );
      })}
    </div>
  );
}
