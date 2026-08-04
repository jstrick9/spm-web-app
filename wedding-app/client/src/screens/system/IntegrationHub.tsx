/**
 * IntegrationHub — owner-friendly integration setup + webhook operations.
 *
 * This screen intentionally combines real backend integration state with
 * first-time setup guidance and provider-specific starter templates. Secrets
 * are only submitted to backend integration endpoints and are never rendered
 * after save.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Bell, Blocks, CalendarDays, CheckCircle2, CloudSun, Code2,
  CreditCard, ExternalLink, FileSignature, Globe, HelpCircle, Mail, MessageSquare,
  Plus, RefreshCw, Send, ShieldAlert, Smartphone, Trash2, Users, Wand2, Workflow, XCircle,
} from 'lucide-react';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { useToast } from '../../ui/Toast';
import { usePrompt } from '../../ui/usePrompt';
import { sdk } from '../../sdk';
import type { SdkIntegration, SdkIntegrationProvider, IntegrationStatus } from '../../sdk/integrations';
import type { SdkWebhook } from '../../sdk/webhooks';
import { cn } from '../../ui/lib/cn';
import { usePermission } from '../../lib/usePermission';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../ui/Dialog';

interface Props { orgId: string }

type ProviderTemplate = SdkIntegrationProvider & {
  setupLevel: 'ready' | 'template' | 'oauth_required';
  ownerSetup: string[];
  plainLanguageTest: string;
};

const REQUESTED_PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'google_calendar', name: 'Google Calendar', category: 'calendar', kind: 'oauth', capabilities: ['push_calendar', 'fetch_calendar'],
    description: 'Publish events, tours, rehearsals, staff shifts, and final timelines to Google Calendar.', iconKey: 'calendar', setupLevel: 'oauth_required',
    ownerSetup: ['Choose the venue calendar to sync', 'Approve Google OAuth access', 'Pick which event statuses should appear'],
    plainLanguageTest: 'We will verify that the calendar can be read and that a draft test event can be created or removed.',
  },
  {
    id: 'outlook_calendar', name: 'Outlook Calendar', category: 'calendar', kind: 'oauth', capabilities: ['push_calendar', 'fetch_calendar'],
    description: 'Sync tours, booked events, and internal deadlines to Microsoft 365 / Outlook calendars.', iconKey: 'calendar', setupLevel: 'oauth_required',
    ownerSetup: ['Connect Microsoft 365', 'Select shared venue calendar', 'Choose push/pull sync rules'],
    plainLanguageTest: 'We will confirm Microsoft Graph access and calendar write permission.',
  },
  {
    id: 'gmail_smtp', name: 'Gmail transactional email preset', category: 'email', kind: 'smtp', capabilities: ['send_email'],
    description: 'Use Gmail SMTP/app passwords for RSVP, payment, portal, and vendor notifications.', iconKey: 'mail', setupLevel: 'template',
    ownerSetup: ['Create a Google app password', 'Use smtp.gmail.com on port 587', 'Send a verification email'],
    plainLanguageTest: 'We will ask Gmail if the host, username, and app password are accepted.',
  },
  {
    id: 'outlook_smtp', name: 'Outlook transactional email preset', category: 'email', kind: 'smtp', capabilities: ['send_email'],
    description: 'Use Microsoft SMTP for transactional venue emails when OAuth mail is not yet configured.', iconKey: 'mail', setupLevel: 'template',
    ownerSetup: ['Use smtp.office365.com on port 587', 'Confirm SMTP auth is enabled', 'Send a verification email'],
    plainLanguageTest: 'We will verify that Microsoft accepts the SMTP credentials and sender address.',
  },
  {
    id: 'zapier', name: 'Zapier templates', category: 'automation', kind: 'webhook_only', capabilities: ['receive_webhook'],
    description: 'Starter Zaps for new inquiry, RSVP submitted, payment paid, vendor COI missing, and event health drop.', iconKey: 'blocks', setupLevel: 'template',
    ownerSetup: ['Create a Zapier catch-hook', 'Add it as an outbound webhook', 'Send a test delivery'],
    plainLanguageTest: 'We will send a test payload and show the delivery status/response from Zapier.',
  },
  {
    id: 'make', name: 'Make templates', category: 'automation', kind: 'webhook_only', capabilities: ['receive_webhook'],
    description: 'Make.com scenarios for lead routing, inquiry import, reminders, and finance handoff.', iconKey: 'blocks', setupLevel: 'template',
    ownerSetup: ['Create a Make webhook scenario', 'Paste the webhook URL', 'Confirm Make receives a test payload'],
    plainLanguageTest: 'We will send a test payload and display Make response details.',
  },
  {
    id: 'crm_import', name: 'CRM inquiry import', category: 'crm', kind: 'api_key', capabilities: ['import_leads'],
    description: 'Import venue inquiries from CRM tools into the event pipeline with source attribution.', iconKey: 'users', setupLevel: 'template',
    ownerSetup: ['Map inquiry fields', 'Choose duplicate handling', 'Run a sample import'],
    plainLanguageTest: 'We will check that sample lead fields map to the platform without duplicate collisions.',
  },
  {
    id: 'website_lead_embed', name: 'Website lead form embed', category: 'website', kind: 'webhook_only', capabilities: ['import_leads'],
    description: 'Embeddable inquiry form script/iframe for venue websites and landing pages.', iconKey: 'code', setupLevel: 'template',
    ownerSetup: ['Copy embed snippet', 'Set required inquiry fields', 'Submit one test lead from your website'],
    plainLanguageTest: 'We will confirm a test website inquiry reaches the event pipeline.',
  },
  {
    id: 'sms_provider', name: 'SMS provider', category: 'sms', kind: 'api_key', capabilities: ['send_sms'],
    description: 'SMS reminders for RSVP deadlines, vendor load-in, staff incidents, and critical health alerts.', iconKey: 'message', setupLevel: 'template',
    ownerSetup: ['Add provider API key', 'Verify sending number', 'Send one internal test SMS'],
    plainLanguageTest: 'We will send a test SMS to an internal number and show the provider response.',
  },
  {
    id: 'weather_provider', name: 'Weather provider for Plan B alerts', category: 'weather', kind: 'api_key', capabilities: ['weather_alerts'],
    description: 'Weather checks for outdoor ceremonies, tenting decisions, and rain-plan alert recommendations.', iconKey: 'weather', setupLevel: 'template',
    ownerSetup: ['Add weather API key', 'Set venue coordinates', 'Choose alert lead times'],
    plainLanguageTest: 'We will verify the venue forecast endpoint returns current and event-day conditions.',
  },
  {
    id: 'weddingwire_theknot', name: 'WeddingWire / The Knot', category: 'marketplace', kind: 'api_key', capabilities: ['import_leads'],
    description: 'Import marketplace inquiries with campaign source and response SLA tracking.', iconKey: 'users', setupLevel: 'template',
    ownerSetup: ['Export or connect marketplace leads', 'Map lead source fields', 'Test one inquiry import'],
    plainLanguageTest: 'We will verify one sample marketplace inquiry lands in the Lead stage.',
  },
  {
    id: 'facebook_marketplace', name: 'Facebook Marketplace', category: 'marketplace', kind: 'api_key', capabilities: ['import_leads'],
    description: 'Track inquiry source from Facebook Marketplace / lead ads into venue pipeline reporting.', iconKey: 'users', setupLevel: 'template',
    ownerSetup: ['Connect Meta lead source', 'Map campaign/name/contact fields', 'Run a sample lead sync'],
    plainLanguageTest: 'We will confirm a sample Facebook inquiry imports with source attribution.',
  },
  {
    id: 'docusign', name: 'DocuSign', category: 'esign', kind: 'oauth', capabilities: ['send_esign_envelope'],
    description: 'Send venue contracts for signature and reconcile completion back to contract status.', iconKey: 'signature', setupLevel: 'oauth_required',
    ownerSetup: ['Connect DocuSign', 'Choose default template/envelope', 'Send an internal test envelope'],
    plainLanguageTest: 'We will verify account access and envelope sending permissions.',
  },
];

const EMAIL_PRESETS = {
  gmail: { label: 'Gmail SMTP', host: 'smtp.gmail.com', port: 587, secure: false, help: 'Use a Google app password, not your normal Google password.' },
  outlook: { label: 'Outlook / Microsoft 365 SMTP', host: 'smtp.office365.com', port: 587, secure: false, help: 'SMTP authentication may need to be enabled in Microsoft 365 admin.' },
  smtp: { label: 'Custom SMTP', host: '', port: 587, secure: false, help: 'Use any provider that supports SMTP: SendGrid, Postmark, Mailgun, or self-hosted mail.' },
} as const;

export function IntegrationHub({ orgId }: Props) {
  const { ask, askConfirm, promptNode } = usePrompt();
  const { toast } = useToast();
  const qc = useQueryClient();
  // IN-07: permission-based (no raw roleKey); managers/custom roles with
  // integrations.view get the read-only operations center, only
  // org.settings.manage can configure credentials.
  const canViewIntegrations = usePermission('integrations.view');
  const managerMode = canViewIntegrations && !usePermission('org.settings.manage');
  const canManageSettings = usePermission('org.settings.manage');
  const [addOpen, setAddOpen] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [emailWizardOpen, setEmailWizardOpen] = useState(false);
  const [paymentWizardOpen, setPaymentWizardOpen] = useState<null | 'stripe' | 'square'>(null);
  const [smsWizardOpen, setSmsWizardOpen] = useState(false);
  const [setupProvider, setSetupProvider] = useState<ProviderTemplate | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  const webhooksQuery = useQuery({ queryKey: ['webhooks', orgId], queryFn: () => sdk.webhooks.list(orgId) });
  const providersQuery = useQuery({ queryKey: ['integration-providers', orgId], queryFn: () => sdk.integrations.providers(orgId) });
  const integrationsQuery = useQuery({ queryKey: ['integrations', orgId], queryFn: () => sdk.integrations.list(orgId) });
  const deliveriesQuery = useQuery({
    queryKey: ['webhook-deliveries', selectedWebhookId],
    queryFn: () => sdk.webhooks.deliveries(selectedWebhookId!),
    enabled: !!selectedWebhookId,
  });

  const webhooks = webhooksQuery.data?.webhooks ?? [];
  const integrations = integrationsQuery.data?.integrations ?? [];
  const connectedByProvider = useMemo(() => new Map(integrations.map((integration) => [integration.provider, integration])), [integrations]);
  const providers = useMemo(() => mergeProviders(providersQuery.data?.providers ?? []), [providersQuery.data?.providers]);
  const managerStatus = useMemo(() => buildManagerIntegrationStatus(providers, connectedByProvider, webhooks), [providers, connectedByProvider, webhooks]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.webhooks.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', orgId] });
      toast({ title: 'Webhook removed', variant: 'success' });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: (id: string) => sdk.webhooks.test(id),
    onSuccess: (result, id) => {
      setSelectedWebhookId(id);
      qc.invalidateQueries({ queryKey: ['webhook-deliveries', id] });
      toast({ title: 'Webhook test sent', description: result.message || 'Open troubleshooting to see delivery details.', variant: 'success' });
    },
    onError: (error: any) => toast({ title: 'Webhook test failed', description: plainError(error), variant: 'destructive' }),
  });

  const testIntegrationMutation = useMutation({
    mutationFn: ({ providerId }: { providerId: string }) => sdk.integrations.test(orgId, providerId),
    onSuccess: (result, vars) => {
      setTestResult((prev) => ({ ...prev, [vars.providerId]: { ok: result.ok, message: 'Connection test passed. The platform can reach this provider with the saved credentials.' } }));
      qc.invalidateQueries({ queryKey: ['integrations', orgId] });
      toast({ title: 'Connection works', description: 'Saved credentials were accepted.', variant: 'success' });
    },
    onError: (error: any, vars) => {
      const message = plainError(error) || 'The provider did not accept the saved settings. Check credentials and try again.';
      setTestResult((prev) => ({ ...prev, [vars.providerId]: { ok: false, message } }));
      qc.invalidateQueries({ queryKey: ['integrations', orgId] });
      toast({ title: 'Connection test failed', description: message, variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => sdk.webhooks.update(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks', orgId] }),
  });

  return (
    <>
      {promptNode}
      <PageHeader title="Integration Hub" description="Connect calendars, email, payments, lead sources, automations, SMS, weather, and e-signature tools." />
      <PageBody>
        <div className="space-y-5">
          <FirstTimeSetupGuide />
          {managerMode && <ManagerIntegrationOperationsCenter status={managerStatus} canManageSettings={canManageSettings} />}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
            <div className="space-y-5 xl:col-span-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-medium uppercase tracking-wider text-fg-subtle">Integration catalog</h2>
                  <p className="text-sm text-fg-muted">Every card shows whether it is connected, needs setup, or has an error.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEmailWizardOpen(true)}><Mail className="h-4 w-4" /> Email wizard</Button>
                  <Button size="sm" variant="outline" onClick={() => setPaymentWizardOpen('stripe')}><CreditCard className="h-4 w-4" /> Payment wizard</Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {providers.map((provider) => {
                  const integration = connectedByProvider.get(provider.id);
                  const status = integration?.status ?? 'not_connected';
                  const result = testResult[provider.id];
                  return (
                    <Card key={provider.id} className="bg-surface">
                      <CardContent className="flex min-h-[188px] flex-col gap-4 p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2">
                              <ProviderIcon iconKey={provider.iconKey} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-fg">{provider.name}</h3>
                                <ConnectionBadge status={status} />
                              </div>
                              <p className="mt-1 text-sm text-fg-muted">{provider.description}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto space-y-3">
                          {integration?.last_error && (
                            <p className="rounded-lg border border-danger/30 bg-danger/10 p-2 text-xs text-danger">{friendlyIntegrationError(integration.last_error)}</p>
                          )}
                          {integration?.last_synced_at && (
                            <p className="flex items-center gap-1 text-[11px] text-fg-subtle"><RefreshCw className="h-3 w-3" /> Last verified: {new Date(integration.last_synced_at).toLocaleString()}</p>
                          )}
                          {result && (
                            <p className={cn('rounded-lg border p-2 text-xs', result.ok ? 'border-success/30 bg-success-soft text-success' : 'border-danger/30 bg-danger/10 text-danger')}>{result.message}</p>
                          )}
                          <div className="grid gap-2 sm:grid-cols-2">
                            {integration ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-h-11"
                                onClick={() => testIntegrationMutation.mutate({ providerId: provider.id })}
                                disabled={testIntegrationMutation.isPending || !canManageSettings}
                                title={!canManageSettings ? 'Only owner/admin users can run live provider connection tests.' : undefined}
                              >
                                <Send className="h-4 w-4" /> {canManageSettings ? 'Test connection' : 'Owner/admin test'}
                              </Button>
                            ) : (
                              <Button size="sm" className="min-h-11" disabled={!canManageSettings} title={!canManageSettings ? 'Managers can review status and request owner/admin setup.' : undefined} onClick={() => openSetup(provider, setEmailWizardOpen, setPaymentWizardOpen, setSmsWizardOpen, setSetupProvider)}>
                                <Wand2 className="h-4 w-4" /> Start setup
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setSetupProvider(provider)}>
                              <HelpCircle className="h-4 w-4" /> Setup guide
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="space-y-5">
              <WebhookPanel
                orgId={orgId}
                webhooks={webhooks}
                selectedWebhookId={selectedWebhookId}
                onSelectedWebhookId={setSelectedWebhookId}
                deliveriesQuery={deliveriesQuery}
                testWebhook={(id) => testWebhookMutation.mutate(id)}
                toggleWebhook={(id, isActive) => toggleMutation.mutate({ id, isActive })}
                deleteWebhook={async (id) => { if (await askConfirm({ title: 'Delete this webhook?', destructive: true })) deleteMutation.mutate(id); }}
                addOpen={addOpen}
                onAddOpenChange={setAddOpen}
              />

              <DataExportCard orgId={orgId} />
            </div>
          </div>
        </div>
      </PageBody>

      <EmailProviderWizard orgId={orgId} open={emailWizardOpen} onOpenChange={setEmailWizardOpen} />
      <PaymentProviderWizard orgId={orgId} provider={paymentWizardOpen} onOpenChange={setPaymentWizardOpen} />
      <SmsProviderWizard orgId={orgId} open={smsWizardOpen} onOpenChange={setSmsWizardOpen} />
      <SetupGuideDialog provider={setupProvider} onOpenChange={setSetupProvider} />
    </>
  );
}


function buildManagerIntegrationStatus(providers: ProviderTemplate[], connectedByProvider: Map<string, SdkIntegration>, webhooks: SdkWebhook[]) {
  const byCategory = (category: string) => providers.filter(p => p.category === category);
  const connected = providers.filter(p => connectedByProvider.get(p.id)?.status === 'connected');
  const broken = providers.filter(p => connectedByProvider.get(p.id)?.status === 'error' || webhooks.some(w => w.failure_count > 0 || ((w.last_status || 200) >= 400)));
  const ownerAction = providers.filter(p => !connectedByProvider.get(p.id) && ['calendar','sms','weather','esign','crm','website'].includes(p.category));
  const deliveryFailures = webhooks.reduce((sum, w) => sum + (w.failure_count || 0), 0);
  return {
    connectedCount: connected.length,
    brokenCount: broken.length,
    ownerActionCount: ownerAction.length,
    deliveryFailures,
    calendar: byCategory('calendar').some(p => connectedByProvider.get(p.id)?.status === 'connected'),
    email: byCategory('email').some(p => connectedByProvider.get(p.id)?.status === 'connected'),
    sms: byCategory('sms').some(p => connectedByProvider.get(p.id)?.status === 'connected'),
    weather: byCategory('weather').some(p => connectedByProvider.get(p.id)?.status === 'connected'),
    docusign: byCategory('esign').some(p => connectedByProvider.get(p.id)?.status === 'connected'),
    crm: [...byCategory('crm'), ...byCategory('website'), ...byCategory('marketplace')].some(p => connectedByProvider.get(p.id)?.status === 'connected'),
    webhooksActive: webhooks.filter(w => w.is_active).length,
  };
}

function ManagerIntegrationOperationsCenter({ status, canManageSettings }: { status: ReturnType<typeof buildManagerIntegrationStatus>; canManageSettings: boolean }) {
  const panels = [
    { title: 'Calendar sync monitor', icon: <CalendarDays className="h-4 w-4" />, ok: status.calendar, detail: status.calendar ? 'Calendar sync is connected for events/timeline visibility.' : 'Owner action required: connect Google/Outlook calendar to publish events and run sheets.' },
    { title: 'Email delivery status center', icon: <Mail className="h-4 w-4" />, ok: status.email, detail: status.email ? 'Transactional email appears connected.' : 'Email is not connected; guest/vendor/staff messages may not send.' },
    { title: 'SMS delivery troubleshooting', icon: <MessageSquare className="h-4 w-4" />, ok: status.sms, detail: status.sms ? 'SMS provider is connected for operational reminders.' : 'Owner action required: SMS is needed for urgent day-of reminders.' },
    { title: 'Weather/rain-plan alert engine', icon: <CloudSun className="h-4 w-4" />, ok: status.weather, detail: status.weather ? 'Weather provider can power Plan B alerts.' : 'Weather provider missing; managers must monitor forecasts manually.' },
    { title: 'CRM lead handoff monitor', icon: <Users className="h-4 w-4" />, ok: status.crm, detail: status.crm ? 'Lead/import source is connected.' : 'CRM/website inquiry import not connected; sales-to-ops handoff may be manual.' },
    { title: 'DocuSign readiness', icon: <FileSignature className="h-4 w-4" />, ok: status.docusign, detail: status.docusign ? 'E-signature provider connected.' : 'DocuSign not connected; contract signature readiness may require manual review.' },
  ];
  return (
    <div className="space-y-4">
      <Card className="border-brand/20 bg-brand-soft/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Workflow className="h-4 w-4 text-brand" /> Manager integration status panel</CardTitle>
          <CardDescription>Manager-safe view of what is connected, broken, or requires owner/admin action. Live testing and credential edits are owner/admin controlled.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManageSettings && <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning"><ShieldAlert className="inline h-3.5 w-3.5 mr-1" /> Managers can review impact and delivery status, but owner/admin must configure credentials or run live connection tests.</div>}
          <div className="grid gap-3 sm:grid-cols-4">
            <ManagerIntegrationMetric label="Connected" value={status.connectedCount} variant="success" />
            <ManagerIntegrationMetric label="Broken" value={status.brokenCount} variant={status.brokenCount ? 'danger' : 'success'} />
            <ManagerIntegrationMetric label="Owner action" value={status.ownerActionCount} variant={status.ownerActionCount ? 'warning' : 'success'} />
            <ManagerIntegrationMetric label="Webhook failures" value={status.deliveryFailures} variant={status.deliveryFailures ? 'danger' : 'success'} />
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {panels.map(panel => <Card key={panel.title} className={panel.ok ? 'border-success/30' : 'border-warning/30'}><CardContent className="p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-bold text-brand">{panel.icon}{panel.title}</div><Badge variant={panel.ok ? 'success' : 'warning'}>{panel.ok ? 'connected' : 'owner action required'}</Badge></div><p className="mt-2 text-xs text-fg-muted">{panel.detail}</p></CardContent></Card>)}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Integration impact map</CardTitle><CardDescription>What workflows are affected when a provider is missing or broken.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 text-xs">
          <ImpactRow label="Calendar" impact="Events, timeline, staff shifts, and run-of-show visibility." ok={status.calendar} />
          <ImpactRow label="Email/SMS" impact="Guest portal, vendor reminders, staff incident alerts, and owner escalations." ok={status.email && status.sms} />
          <ImpactRow label="Website/CRM" impact="Inquiry import, lead source tracking, and sales-to-ops handoff." ok={status.crm} />
          <ImpactRow label="Weather" impact="Rain-plan alerts, outdoor ceremony decisions, and event-day command center." ok={status.weather} />
          <ImpactRow label="DocuSign" impact="Contract signature readiness and legal/financial go-no-go status." ok={status.docusign} />
          <ImpactRow label="Webhooks" impact="Zapier/Make automations and external reporting handoffs." ok={status.webhooksActive > 0 && status.deliveryFailures === 0} />
        </CardContent>
      </Card>
    </div>
  );
}

function ManagerIntegrationMetric({ label, value, variant }: { label: string; value: number; variant: 'success' | 'warning' | 'danger' }) {
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="text-[10px] uppercase font-bold text-fg-subtle">{label}</div><div className={cn('text-2xl font-bold', variant === 'success' ? 'text-success' : variant === 'warning' ? 'text-warning' : 'text-danger')}>{value}</div></div>;
}

function ImpactRow({ label, impact, ok }: { label: string; impact: string; ok: boolean }) {
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="flex items-center justify-between gap-2"><strong>{label}</strong><Badge variant={ok ? 'success' : 'warning'}>{ok ? 'ready' : 'affected'}</Badge></div><p className="mt-1 text-fg-muted">{impact}</p></div>;
}

function FirstTimeSetupGuide() {
  return (
    <Card className="border-brand/20 bg-brand/5">
      <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Badge variant="success" className="mb-2">First-time setup guide</Badge>
          <h2 className="text-lg font-semibold text-fg">Connect only what your venue needs this week</h2>
          <p className="mt-1 text-sm text-fg-muted">Recommended order: transactional email, payment provider, calendar sync, webhooks/Zapier, then lead sources and SMS/weather alerts.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-3 text-sm text-fg-muted"><strong className="text-fg">Plain-language testing:</strong> after credentials are saved, use Test connection. The result explains whether credentials, permissions, or provider availability caused the issue.</div>
        <div className="rounded-xl border border-border bg-surface p-3 text-sm text-fg-muted"><strong className="text-fg">Mobile/tablet ready:</strong> cards stack, actions are touch-sized, and troubleshooting panels avoid horizontal scrolling on Apple and Android devices.</div>
      </CardContent>
    </Card>
  );
}

function mergeProviders(realProviders: SdkIntegrationProvider[]): ProviderTemplate[] {
  const mapped: ProviderTemplate[] = realProviders.map((provider) => ({
    ...provider,
    setupLevel: 'ready',
    ownerSetup: defaultStepsFor(provider),
    plainLanguageTest: defaultTestFor(provider),
  }));
  const seen = new Set(mapped.map((provider) => provider.id));
  for (const template of REQUESTED_PROVIDER_TEMPLATES) {
    if (!seen.has(template.id)) mapped.push(template);
  }
  const order = ['email', 'payments', 'calendar', 'automation', 'crm', 'website', 'sms', 'weather', 'marketplace', 'esign'];
  return mapped.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name));
}

function defaultStepsFor(provider: SdkIntegrationProvider): string[] {
  if (provider.id === 'email_smtp') return ['Pick Gmail, Outlook, or custom SMTP preset', 'Enter sender address and SMTP credentials', 'Run Test connection'];
  if (provider.id === 'stripe') return ['Add Stripe secret key and publishable key', 'Add webhook signing secret for reconciliation', 'Run Test connection'];
  if (provider.id === 'square') return ['Choose sandbox or production', 'Add location id and access token', 'Run Test connection'];
  if (provider.id === 'sms_twilio') return ['Add Twilio Account SID and sender number', 'Add Auth Token securely', 'Run Test connection before sending SMS'];
  return ['Enter provider credentials', 'Save securely', 'Run Test connection'];
}

function defaultTestFor(provider: SdkIntegrationProvider): string {
  if (provider.category === 'email') return 'We will verify the mail server accepts your credentials.';
  if (provider.category === 'payments') return 'We will verify the payment API accepts your keys and account access.';
  if (provider.category === 'sms') return 'We will validate Twilio credentials and use the worker queue for SMS dispatch.';
  return 'We will verify the provider accepts the saved settings.';
}

function openSetup(
  provider: ProviderTemplate,
  openEmail: (value: boolean) => void,
  openPayment: (value: 'stripe' | 'square' | null) => void,
  openSms: (value: boolean) => void,
  openGuide: (value: ProviderTemplate | null) => void,
) {
  if (provider.id === 'email_smtp' || provider.id === 'gmail_smtp' || provider.id === 'outlook_smtp') openEmail(true);
  else if (provider.id === 'stripe' || provider.id === 'square') openPayment(provider.id as 'stripe' | 'square');
  else if (provider.id === 'sms_twilio' || provider.id === 'sms_provider') openSms(true);
  else openGuide(provider);
}

function ConnectionBadge({ status }: { status: IntegrationStatus | 'not_connected' }) {
  if (status === 'connected') return <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Connected</Badge>;
  if (status === 'error') return <Badge variant="danger"><XCircle className="h-3 w-3" /> Error</Badge>;
  if (status === 'disabled') return <Badge variant="outline">Disabled</Badge>;
  if (status === 'pending') return <Badge variant="warning">Pending test</Badge>;
  return <Badge variant="outline">Not connected</Badge>;
}

function ProviderIcon({ iconKey }: { iconKey?: string }) {
  const cls = 'h-5 w-5 text-fg-muted';
  if (iconKey === 'mail') return <Mail className={cls} />;
  if (iconKey === 'calendar') return <CalendarDays className={cls} />;
  if (iconKey === 'credit-card') return <CreditCard className={cls} />;
  if (iconKey === 'message') return <MessageSquare className={cls} />;
  if (iconKey === 'weather') return <CloudSun className={cls} />;
  if (iconKey === 'code') return <Code2 className={cls} />;
  if (iconKey === 'signature') return <FileSignature className={cls} />;
  if (iconKey === 'users') return <Users className={cls} />;
  return <Blocks className={cls} />;
}

function WebhookPanel({ orgId, webhooks, selectedWebhookId, onSelectedWebhookId, deliveriesQuery, testWebhook, toggleWebhook, deleteWebhook, addOpen, onAddOpenChange }: {
  orgId: string;
  webhooks: SdkWebhook[];
  selectedWebhookId: string | null;
  onSelectedWebhookId: (id: string | null) => void;
  deliveriesQuery: any;
  testWebhook: (id: string) => void;
  toggleWebhook: (id: string, isActive: boolean) => void;
  deleteWebhook: (id: string) => void;
  addOpen: boolean;
  onAddOpenChange: (value: boolean) => void;
}) {
  const selected = webhooks.find((webhook) => webhook.id === selectedWebhookId) ?? webhooks[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4 text-brand" /> Webhooks & troubleshooting</CardTitle>
        <CardDescription>Send event payloads to Zapier, Make, CRMs, and custom systems.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {webhooks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface-2/50 p-4 text-center text-sm text-fg-muted">No webhooks configured yet. Add one, then send a test delivery.</p>
        ) : (
          webhooks.map((wh) => (
            <div key={wh.id} className="rounded-xl border border-border bg-surface-2/30 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-fg-muted">{wh.url}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant={wh.is_active ? 'success' : 'default'} className="text-[10px]">{wh.is_active ? 'Connected' : 'Not connected'}</Badge>
                    {wh.last_status && <span className={cn('text-[10px]', wh.last_status >= 200 && wh.last_status < 300 ? 'text-success' : 'text-danger')}>Last HTTP {wh.last_status}</span>}
                    {wh.failure_count > 0 && <span className="text-[10px] text-danger">{wh.failure_count} failed deliveries</span>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 sm:flex sm:shrink-0">
                  <Button size="xs" variant="outline" className="min-h-9" onClick={() => toggleWebhook(wh.id, !wh.is_active)}>{wh.is_active ? 'Pause' : 'Resume'}</Button>
                  <Button size="xs" variant="outline" className="min-h-9" onClick={() => testWebhook(wh.id)}><Send className="h-3.5 w-3.5" /> Test</Button>
                  <Button size="xs" variant="ghost" className="min-h-9 text-danger" onClick={() => deleteWebhook(wh.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <Button size="xs" variant="ghost" className="mt-2" onClick={() => onSelectedWebhookId(selectedWebhookId === wh.id ? null : wh.id)}>
                {selectedWebhookId === wh.id ? 'Hide troubleshooting' : 'Troubleshoot deliveries'}
              </Button>
            </div>
          ))
        )}

        <AddWebhookDialog orgId={orgId} open={addOpen} onOpenChange={onAddOpenChange} />

        {selected && selectedWebhookId && (
          <Card className="border-dashed bg-bg">
            <CardHeader>
              <CardTitle className="text-sm">Delivery troubleshooting</CardTitle>
              <CardDescription className="text-xs">Plain-language checks for the selected webhook.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-fg-muted">
              <TroubleshootingTips webhook={selected} />
              {deliveriesQuery.isLoading ? <p>Loading delivery attempts…</p> : (
                <div className="space-y-2">
                  {(deliveriesQuery.data?.deliveries ?? []).slice(0, 5).map((delivery: any) => (
                    <div key={delivery.id} className="rounded-lg border border-border bg-surface p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-fg">{delivery.event_type}</span>
                        <Badge variant={delivery.status && delivery.status >= 200 && delivery.status < 300 ? 'success' : 'danger'}>{delivery.status ?? 'Error'}</Badge>
                      </div>
                      <p className="mt-1">{delivery.error || delivery.response || 'Delivery accepted.'}</p>
                    </div>
                  ))}
                  {(deliveriesQuery.data?.deliveries ?? []).length === 0 && <p>No deliveries logged yet. Send a test webhook to create the first troubleshooting record.</p>}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

function TroubleshootingTips({ webhook }: { webhook: SdkWebhook }) {
  const tips = [];
  if (!webhook.is_active) tips.push('This webhook is paused. Resume it before testing.');
  if ((webhook.last_status ?? 200) >= 400) tips.push('The last response was an error. Check the receiving app URL and whether it requires authentication.');
  if (webhook.failure_count > 0) tips.push('Failures usually mean the destination timed out, rejected the payload, or returned a non-2xx status.');
  if (!tips.length) tips.push('This webhook looks healthy. If the destination app did not update, check field mapping in Zapier/Make/CRM.');
  return <ul className="space-y-1 rounded-lg border border-border bg-surface p-3">{tips.map((tip) => <li key={tip}>• {tip}</li>)}</ul>;
}

function DataExportCard({ orgId }: { orgId: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Data export</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <a href={`/api/orgs/${orgId}/export/guests.csv`} download><Button variant="outline" className="min-h-11 w-full justify-between group">Export All Guests (CSV) <ExternalLink className="h-4 w-4 text-fg-subtle group-hover:text-fg" /></Button></a>
        <a href={`/api/orgs/${orgId}/export/financials.json`} download><Button variant="outline" className="min-h-11 w-full justify-between group">Export Financials (JSON) <ExternalLink className="h-4 w-4 text-fg-subtle group-hover:text-fg" /></Button></a>
        <a href={`/api/orgs/${orgId}/export/vendors.csv`} download><Button variant="outline" className="min-h-11 w-full justify-between group">Export Vendors (CSV) <ExternalLink className="h-4 w-4 text-fg-subtle group-hover:text-fg" /></Button></a>
      </CardContent>
    </Card>
  );
}

function EmailProviderWizard({ orgId, open, onOpenChange }: { orgId: string; open: boolean; onOpenChange: (value: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';
  const canManageSettings = usePermission('org.settings.manage');
  const [preset, setPreset] = useState<keyof typeof EMAIL_PRESETS>('gmail');
  const selected = EMAIL_PRESETS[preset];
  const [host, setHost] = useState<string>(selected.host);
  const [port, setPort] = useState<number>(selected.port);
  const [secure, setSecure] = useState<boolean>(selected.secure);
  const [fromAddress, setFromAddress] = useState('');
  const [fromName, setFromName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  function applyPreset(next: keyof typeof EMAIL_PRESETS) {
    setPreset(next);
    setHost(EMAIL_PRESETS[next].host);
    setPort(EMAIL_PRESETS[next].port);
    setSecure(EMAIL_PRESETS[next].secure);
  }

  const saveMutation = useMutation({
    mutationFn: () => sdk.integrations.upsert(orgId, {
      provider: 'email_smtp',
      displayName: selected.label,
      config: { host, port, secure, fromAddress, fromName: fromName || undefined },
      secrets: { username, password },
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['integrations', orgId] });
      toast({
        title: result.integration.status === 'connected' ? 'Email provider connected' : 'Email settings saved',
        description: result.integration.status === 'connected' ? 'Transactional email is ready.' : friendlyIntegrationError(result.integration.last_error ?? 'Test connection to see what needs attention.'),
        variant: result.integration.status === 'connected' ? 'success' : 'default',
      });
      onOpenChange(false);
    },
    onError: (error: any) => toast({ title: 'Could not save email provider', description: plainError(error), variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Email provider setup wizard</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(EMAIL_PRESETS) as Array<keyof typeof EMAIL_PRESETS>).map((key) => <Button key={key} variant={preset === key ? 'default' : 'outline'} onClick={() => applyPreset(key)}>{EMAIL_PRESETS[key].label}</Button>)}
          </div>
          <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-muted">{selected.help}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="SMTP host" value={host} onChange={setHost} />
            <Field label="Port" value={String(port)} onChange={(value) => setPort(Number(value) || 587)} type="number" />
            <Field label="From address" value={fromAddress} onChange={setFromAddress} type="email" />
            <Field label="From name" value={fromName} onChange={setFromName} />
            <Field label="Username" value={username} onChange={setUsername} />
            <Field label="Password / app password" value={password} onChange={setPassword} type="password" />
          </div>
          <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={secure} onChange={(event) => setSecure(event.target.checked)} className="h-4 w-4 accent-brand" /> Use implicit TLS (usually port 465)</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!host || !fromAddress || !username || !password || saveMutation.isPending} isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save & test email</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SmsProviderWizard({ orgId, open, onOpenChange }: { orgId: string; open: boolean; onOpenChange: (value: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManageSettings = usePermission('org.settings.manage');
  const [accountSid, setAccountSid] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [messagingServiceSid, setMessagingServiceSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const saveMutation = useMutation({
    mutationFn: () => sdk.integrations.upsert(orgId, {
      provider: 'sms_twilio',
      displayName: 'Twilio SMS',
      config: { accountSid, fromNumber, messagingServiceSid: messagingServiceSid || undefined },
      secrets: { authToken },
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['integrations', orgId] });
      toast({ title: result.integration.status === 'connected' ? 'Twilio SMS connected' : 'Twilio SMS settings saved', description: result.integration.status === 'connected' ? 'SMS follow-ups can now be dispatched through the worker queue.' : friendlyIntegrationError(result.integration.last_error ?? 'Run Test connection after checking credentials.'), variant: result.integration.status === 'connected' ? 'success' : 'default' });
      onOpenChange(false);
    },
    onError: (error: any) => toast({ title: 'Could not save Twilio SMS', description: plainError(error), variant: 'destructive' }),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Twilio SMS setup wizard</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!canManageSettings && <p className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning">Only owner/admin users can save Twilio credentials. Managers can review readiness and request setup.</p>}
          <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-muted">SMS is used for urgent post-event follow-ups and future reminder workflows. Credentials are sealed server-side and never rendered after save.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Twilio Account SID" value={accountSid} onChange={setAccountSid} />
            <Field label="From phone number" value={fromNumber} onChange={setFromNumber} />
            <Field label="Messaging Service SID (optional)" value={messagingServiceSid} onChange={setMessagingServiceSid} />
            <Field label="Auth token" value={authToken} onChange={setAuthToken} type="password" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!canManageSettings || !accountSid || (!fromNumber && !messagingServiceSid) || !authToken || saveMutation.isPending} isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save & test SMS</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentProviderWizard({ orgId, provider, onOpenChange }: { orgId: string; provider: 'stripe' | 'square' | null; onOpenChange: (value: 'stripe' | 'square' | null) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';
  const canManageSettings = usePermission('org.settings.manage');
  const [mode, setMode] = useState<'stripe' | 'square'>(provider ?? 'stripe');
  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [squareEnv, setSquareEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [squareLocation, setSquareLocation] = useState('');
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    if (provider) setMode(provider);
  }, [provider]);

  const saveMutation = useMutation({ 
    mutationFn: () => mode === 'stripe'
      ? sdk.integrations.upsert(orgId, {
        provider: 'stripe', displayName: 'Stripe', config: { publishableKey }, secrets: { secretKey, webhookSigningSecret: webhookSecret || undefined },
      })
      : sdk.integrations.upsert(orgId, {
        provider: 'square', displayName: 'Square', config: { environment: squareEnv, locationId: squareLocation, currency }, secrets: { accessToken: secretKey, webhookSignatureKey: webhookSecret || undefined },
      }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['integrations', orgId] });
      toast({ title: `${mode === 'stripe' ? 'Stripe' : 'Square'} settings saved`, description: result.integration.status === 'connected' ? 'Payment provider is ready for deeper reconciliation.' : friendlyIntegrationError(result.integration.last_error ?? 'Run Test connection after checking credentials.'), variant: result.integration.status === 'connected' ? 'success' : 'default' });
      onOpenChange(null);
    },
    onError: (error: any) => toast({ title: 'Could not save payment provider', description: plainError(error), variant: 'destructive' }),
  });

  return (
    <Dialog open={!!provider} onOpenChange={(value) => onOpenChange(value ? mode : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Payment provider setup wizard</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant={mode === 'stripe' ? 'default' : 'outline'} onClick={() => setMode('stripe')}>Stripe reconciliation</Button>
            <Button variant={mode === 'square' ? 'default' : 'outline'} onClick={() => setMode('square')}>Square reconciliation</Button>
          </div>
          <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-muted">Hosted checkout keeps card data out of this platform. Webhook secrets enable deeper reconciliation: paid, failed, refunded, and external payment IDs.</p>
          {mode === 'stripe' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Publishable key" value={publishableKey} onChange={setPublishableKey} />
              <Field label="Secret key" value={secretKey} onChange={setSecretKey} type="password" />
              <Field label="Webhook signing secret" value={webhookSecret} onChange={setWebhookSecret} type="password" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Environment</Label><select value={squareEnv} onChange={(event) => setSquareEnv(event.target.value as any)} className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm"><option value="sandbox">Sandbox</option><option value="production">Production</option></select></div>
              <Field label="Location ID" value={squareLocation} onChange={setSquareLocation} />
              <Field label="Access token" value={secretKey} onChange={setSecretKey} type="password" />
              <Field label="Currency" value={currency} onChange={setCurrency} />
              <Field label="Webhook signature key" value={webhookSecret} onChange={setWebhookSecret} type="password" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(null)}>Cancel</Button>
          <Button disabled={!secretKey || saveMutation.isPending} isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>Save & test payments</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetupGuideDialog({ provider, onOpenChange }: { provider: ProviderTemplate | null; onOpenChange: (value: ProviderTemplate | null) => void }) {
  return (
    <Dialog open={!!provider} onOpenChange={(open) => !open && onOpenChange(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>{provider?.name} setup guide</DialogTitle></DialogHeader>
        {provider && (
          <div className="space-y-4 text-sm text-fg-muted">
            <ConnectionBadge status="not_connected" />
            <p>{provider.description}</p>
            <div className="rounded-xl border border-border bg-surface-2 p-3">
              <h3 className="mb-2 font-semibold text-fg">Owner setup steps</h3>
              <ol className="list-decimal space-y-1 pl-5">{provider.ownerSetup.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
            <div className="rounded-xl border border-border bg-surface-2 p-3">
              <h3 className="mb-1 font-semibold text-fg">What Test connection will mean</h3>
              <p>{provider.plainLanguageTest}</p>
            </div>
            {provider.setupLevel !== 'ready' && <p className="rounded-xl border border-warning/30 bg-warning/10 p-3"><AlertTriangle className="mr-2 inline h-4 w-4" />This provider is scaffolded as an integration template. Use webhooks/API credentials now; full OAuth or native sync can be connected when provider credentials are available.</p>}
          </div>
        )}
        <DialogFooter><Button onClick={() => onOpenChange(null)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} type={type} className="mt-1" /></div>;
}

// ─── Add Webhook Dialog ─────────────────────────────────
function AddWebhookDialog({ orgId, open, onOpenChange }: {
  orgId: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';
  const canManageSettings = usePermission('org.settings.manage');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [desc, setDesc] = useState('');

  const createMutation = useMutation({
    mutationFn: () => sdk.webhooks.create(orgId, { url, secret: secret || undefined, description: desc || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', orgId] });
      toast({ title: 'Webhook created', description: 'Send a test delivery to confirm the receiving app is listening.', variant: 'success' });
      onOpenChange(false);
      setUrl(''); setSecret(''); setDesc('');
    },
    onError: () => toast({ title: 'Invalid webhook URL', description: 'Use a full https:// URL from Zapier, Make, your CRM, or your website backend.', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild><Button variant="outline" className="min-h-11 w-full"><Plus className="h-4 w-4" /> Add Webhook</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add outbound webhook</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="URL" value={url} onChange={setUrl} />
          <Field label="Signing secret (optional)" value={secret} onChange={setSecret} />
          <p className="text-[11px] text-fg-subtle">Used by the receiving app to verify this platform sent the payload.</p>
          <Field label="Description (optional)" value={desc} onChange={setDesc} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!url.trim() || createMutation.isPending} isLoading={createMutation.isPending} onClick={() => createMutation.mutate()}>Create Webhook</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function friendlyIntegrationError(error: string): string {
  if (/auth|unauthor|credential|password|token|key/i.test(error)) return 'The provider rejected the credentials. Re-enter the key/password and make sure the account has the required permissions.';
  if (/timeout|network|fetch|unreachable/i.test(error)) return 'The provider could not be reached. Check network allowlists, host names, and provider status.';
  if (/SMTP/i.test(error)) return 'The email server did not accept the SMTP settings. Check host, port, TLS, username, and app password.';
  return error;
}

function plainError(error: any): string {
  return error?.message || error?.error || 'Unexpected provider error.';
}
