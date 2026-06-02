/**
 * LifecycleEmailsPanel — event-level lifecycle email controls.
 *
 * Lets venue staff manually fire a lifecycle trigger (RSVP reminder, thank-you,
 * save-the-date) for THIS event and review the per-guest send log. Automation
 * rules + templates are configured org-wide; this panel surfaces the
 * "send now" action and the resulting log, which is what staff touch day-to-day.
 *
 * Triggers are idempotent server-side: re-sending never double-emails a guest.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, MailCheck, RefreshCw } from 'lucide-react';
import { sdk } from '../../../sdk';
import type { LifecycleTrigger } from '../../../sdk/lifecycleEmails';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { StatCard } from '../../../ui/StatCard';
import { DataTable, type Column } from '../../../ui/DataTable';
import { useToast } from '../../../ui/Toast';
import { usePermission } from '../../../lib/usePermission';

interface Props { eventId: string }

const TRIGGERS: Array<{ id: LifecycleTrigger; label: string; help: string }> = [
  { id: 'rsvp_reminder', label: 'RSVP Reminder', help: 'Guests who have not responded yet' },
  { id: 'thank_you',     label: 'Thank-You',     help: 'Guests marked attending' },
  { id: 'save_the_date', label: 'Save the Date', help: 'All guests with an email' },
];

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  sent: 'success', pending: 'warning', failed: 'danger', skipped: 'default',
};

export function LifecycleEmailsPanel({ eventId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const canSend = usePermission('invites.send');
  const [busyTrigger, setBusyTrigger] = useState<LifecycleTrigger | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['lifecycle-emails', eventId],
    queryFn: () => sdk.lifecycleEmails.log(eventId),
  });
  const emails = data?.emails ?? [];
  const stats = data?.stats ?? { pending: 0, sent: 0, failed: 0, skipped: 0 };

  const sendMutation = useMutation({
    mutationFn: (trigger: LifecycleTrigger) => sdk.lifecycleEmails.send(eventId, trigger),
    onMutate: (t) => setBusyTrigger(t),
    onSuccess: ({ result }) => {
      qc.invalidateQueries({ queryKey: ['lifecycle-emails', eventId] });
      if (result.reason === 'no-smtp-integration') {
        toast({ title: 'No email provider connected', description: 'Connect an SMTP integration in the Integration Hub first.', variant: 'destructive' });
      } else if (result.reason === 'no-active-automation') {
        toast({ title: 'No automation configured', description: 'Create an enabled automation rule for this trigger in Settings.', variant: 'destructive' });
      } else if (result.scheduled === 0) {
        toast({ title: 'Nothing to send', description: `All eligible guests were already emailed (${result.skipped} skipped).` });
      } else {
        toast({ title: 'Emails queued', description: `${result.scheduled} email(s) queued for delivery.`, variant: 'success' });
      }
    },
    onError: () => toast({ title: 'Send failed', variant: 'destructive' }),
    onSettled: () => setBusyTrigger(null),
  });

  const columns: Column<typeof emails[number]>[] = [
    { id: 'recipient_email', header: 'Recipient', cell: (r) => r.recipient_email },
    { id: 'subject', header: 'Subject', cell: (r) => r.subject },
    {
      id: 'trigger_type', header: 'Type',
      cell: (r) => <span className="capitalize">{r.trigger_type.replace(/_/g, ' ')}</span>,
    },
    {
      id: 'status', header: 'Status',
      cell: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{r.status}</Badge>,
    },
    {
      id: 'sent_at', header: 'Sent',
      cell: (r) => r.sent_at ? new Date(r.sent_at).toLocaleString() : '—',
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MailCheck className="h-4 w-4 text-brand" /> Lifecycle Emails
        </CardTitle>
        <Button
          variant="ghost" size="sm"
          aria-label="Refresh send log"
          onClick={() => qc.invalidateQueries({ queryKey: ['lifecycle-emails', eventId] })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Sent" value={stats.sent} />
          <StatCard label="Pending" value={stats.pending} />
          <StatCard label="Failed" value={stats.failed} />
          <StatCard label="Skipped" value={stats.skipped} />
        </div>

        {/* Send actions */}
        <div>
          <p className="text-sm text-fg-muted mb-3">
            Fire a lifecycle email for this event. Already-emailed guests are skipped automatically.
          </p>
          <div className="flex flex-wrap gap-2">
            {TRIGGERS.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                size="sm"
                disabled={!canSend || sendMutation.isPending}
                onClick={() => sendMutation.mutate(t.id)}
                title={canSend ? t.help : 'You need the invites.send permission'}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {busyTrigger === t.id ? 'Sending...' : t.label}
              </Button>
            ))}
          </div>
          {!canSend && (
            <p className="text-xs text-fg-subtle mt-2">You don't have permission to send emails.</p>
          )}
        </div>

        {/* Send log */}
        <div>
          <h4 className="text-sm font-medium mb-2">Send Log</h4>
          {isLoading ? (
            <p className="text-sm text-fg-muted py-6 text-center">Loading...</p>
          ) : emails.length === 0 ? (
            <p className="text-sm text-fg-muted py-6 text-center border border-dashed border-border rounded-md">
              No lifecycle emails have been sent for this event yet.
            </p>
          ) : (
            <DataTable data={emails} columns={columns} getRowKey={(r) => r.id} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
