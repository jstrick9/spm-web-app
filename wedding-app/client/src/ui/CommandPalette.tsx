/**
 * CommandPalette — ⌘K navigation + quick actions.
 *
 * Built on `cmdk` (the library shadcn uses) wrapped in a Radix Dialog.
 *
 *   <CommandPalette
 *     open={open}
 *     onOpenChange={setOpen}
 *     items={[
 *       { id: 'goto.events',  label: 'Go to Events',  hint: 'Navigation', onSelect: () => navigate('/events') },
 *       { id: 'create.event', label: 'Create event',  hint: 'Action',     onSelect: () => navigate('/events/new') },
 *     ]}
 *   />
 *
 * The host wires ⌘K / Ctrl+K via a keyboard listener (see App.tsx).
 */
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { cn } from './lib/cn';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;            // grouped section label (e.g. "Navigation", "Action")
  icon?: ReactNode;
  keywords?: string[];      // extra search terms beyond label
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
}

export function CommandPalette({
  open, onOpenChange, items, placeholder = 'Type a command or search…',
}: CommandPaletteProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const item of items) {
      const key = item.hint ?? 'Results';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-[15vh] z-50 w-[92vw] max-w-xl -translate-x-1/2',
            'rounded-card border border-border bg-surface shadow-elev-2 overflow-hidden',
            'duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command label="Command Menu">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
              <Command.Input
                placeholder={placeholder}
                className="flex-1 bg-transparent h-12 px-1 text-sm outline-none placeholder:text-fg-subtle"
              />
              <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-surface-2 px-1.5 text-[10px] font-mono text-fg-subtle">
                ESC
              </kbd>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-fg-muted">
                No results.
              </Command.Empty>
              {grouped.map(([heading, list]) => (
                <Command.Group
                  key={heading}
                  heading={heading}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle"
                >
                  {list.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${(item.keywords ?? []).join(' ')}`}
                      onSelect={() => { item.onSelect(); onOpenChange(false); }}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer',
                        'data-[selected=true]:bg-brand-soft data-[selected=true]:text-brand-strong',
                      )}
                    >
                      {item.icon && <span className="text-fg-muted">{item.icon}</span>}
                      <span className="flex-1">{item.label}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
