import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { sdk } from '../../sdk';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { useToast } from '../../ui/Toast';

export function CoupleReminderCenter({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const remindersQuery = useQuery({ queryKey: ['couple-reminders', eventId], queryFn: () => sdk.couple.reminders(eventId), enabled: !!eventId });
  const notificationPrefsQuery = useQuery({ queryKey: ['couple-notification-preferences', eventId], queryFn: () => sdk.couple.notificationPreferences(eventId), enabled: !!eventId });
  const digestMutation = useMutation({
    mutationFn: () => sdk.couple.sendReminderDigest(eventId),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['couple-reminders', eventId] }); toast({ title: res.delivered ? 'Wedding planning digest sent' : 'Digest recorded', description: res.delivered ? 'Emailed to your account.' : 'Saved to your reminder history — connect venue email to get it delivered.', variant: res.delivered ? 'success' : 'default' }); },
  });
  const notificationPrefsMutation = useMutation({
    mutationFn: () => sdk.couple.updateNotificationPreferences(eventId, { digestFrequency: notificationPrefsQuery.data?.preferences.digest_frequency === 'instant' ? 'daily' : 'instant', messageAlerts: true, decisionAlerts: true, dueTaskAlerts: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-notification-preferences', eventId] }); toast({ title: 'Notification preferences saved', variant: 'success' }); },
  });

  return (
    <Card className="border-brand/20 bg-brand-soft/10">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-brand" /> Couple Reminder Center</CardTitle><CardDescription>Couple-friendly reminders for RSVP, payments, documents, signatures, appointments, final count, and smart planning nudges.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{remindersQuery.data?.reminders.length ?? 0}</strong><p className="text-xs text-fg-muted">active reminders</p></div><div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3"><strong>{remindersQuery.data?.reminders.filter((r) => r.priority === 'high').length ?? 0}</strong><p className="text-xs text-warning">high priority</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{remindersQuery.data?.history.length ?? 0}</strong><p className="text-xs text-fg-muted">notification history</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{notificationPrefsQuery.data?.preferences.digest_frequency || 'daily'}</strong><p className="text-xs text-fg-muted">digest mode</p></div></div>
        <div className="grid gap-2 lg:grid-cols-2">{(remindersQuery.data?.reminders || []).slice(0, 8).map((reminder) => <div key={reminder.key} className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><strong>{reminder.title}</strong><p className="text-xs text-fg-muted">{reminder.body}</p><p className="mt-1 text-xs text-fg-subtle">Due: {reminder.dueAt || 'not scheduled'} · {reminder.channel} · route to {reminder.recipientRole}</p></div><Badge variant={reminder.priority === 'high' ? 'warning' : 'outline'}>{reminder.priority}</Badge></div></div>)}</div>
        <div className="grid gap-3 lg:grid-cols-3"><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Preferences</strong><p>Email: {notificationPrefsQuery.data?.preferences.email_enabled ? 'on' : 'off'} · SMS: {notificationPrefsQuery.data?.preferences.sms_enabled ? 'on' : 'off'} · In-app: {notificationPrefsQuery.data?.preferences.in_app_enabled ? 'on' : 'off'}</p><p>Quiet hours: {notificationPrefsQuery.data?.preferences.quiet_hours || '{}'}</p></div><div className="rounded-lg border border-border bg-surface-2 p-3 text-xs"><strong>Partner/planner routing</strong><p>Reminders can be routed to couple, approved partner, or approved planner roles. Partner/planner routing follows venue-approved access controls.</p></div><div className="rounded-lg border border-brand/20 bg-brand-soft/10 p-3 text-xs text-brand"><strong>Smart nudges</strong><p>Missing profile details, final count, RSVP lag, unsigned documents, payments, and appointment prep create couple-friendly nudges without staff/vendor operations language.</p></div></div>
        <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => digestMutation.mutate()} isLoading={digestMutation.isPending}>Send wedding planning digest</Button><Button size="sm" variant="outline" onClick={() => notificationPrefsMutation.mutate()} isLoading={notificationPrefsMutation.isPending}>Toggle instant/daily digest</Button></div>
      </CardContent>
    </Card>
  );
}
