/**
 * KeyboardShortcutsDialog — discoverable via ⌘/ or Ctrl+/ or from user menu.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Open command palette', description: 'Search events, vendors, and navigate' },
  { keys: ['⌘', 'N'], label: 'Create new event', description: 'Open the create event dialog from anywhere' },
  { keys: ['⌘', '/'], label: 'Keyboard shortcuts', description: 'Show this help dialog' },
  { keys: ['Esc'], label: 'Close dialog/dropdown', description: 'Close any open dialog or menu' },
  { keys: ['Tab'], label: 'Navigate fields', description: 'Move between form fields and buttons' },
  { keys: ['Enter'], label: 'Submit/confirm', description: 'Submit forms or confirm actions' },
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-fg">{s.label}</p>
                <p className="text-xs text-fg-muted">{s.description}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-4">
                {s.keys.map((key, j) => (
                  <kbd key={j} className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded border border-border bg-surface-2 text-[11px] font-mono text-fg-muted">
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
