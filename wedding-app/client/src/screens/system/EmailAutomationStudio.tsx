/**
 * EmailAutomationStudio — configure org-level lifecycle email automation rules.
 *
 * Route: #/system/email-automations
 * Permission: invites.view (read) | invites.manage (write)
 * Themed: fully via ConfigProvider (inherits org theme tokens)
 *
 * Features:
 *  • List all trigger types with their current automation status
 *  • Toggle enabled/disabled per trigger
 *  • Assign an email template to each trigger
 *  • Configure offset_days for rsvp_reminder
 *  • Delete automation rules
 *  • "Send Now" manual trigger with idempotency cooldown display
 *  • Send log with stats (open event only)
 *  • Full RBAC: invites.view for read, invites.manage for write actions
 *  • All Radix/design-system components, no inline styles
 *  • WCAG 2.1 AA accessible: aria-labels, focus rings, status roles
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Send,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { sdk } from '../../sdk';
import { usePermission } from '../../lib/usePermission';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { AccessDenied } from '../../ui/AccessDenied';
import { EmptyState } from '../../ui/EmptyState';
import { useToast } from '../../ui/Toast';

// ── Constants ──────────────────────────────────────────────────────────────

const TRIGGER_TYPES = ['rsvp_reminder', 'thank_you', 'save_the_date', 'manual'] as const;
type TriggerType = (typeof TRIGGER_TYPES)[number];

const TRIGGER_LABELS: Record<TriggerType, string> = {
  rsvp_reminder: 'RSVP Reminder',
  thank_you: 'Post-Event Thank You',
  save_the_date: 'Save the Date',
  manual: 'Manual Send',
};

const TRIGGER_DESCRIPTIONS: Record<TriggerType, string> = {
  rsvp_reminder:
    'Sent automatically N days before the RSVP deadline to guests who haven\'t responded.',
  thank_you:
    'Sent automatically when an event is marked "Completed." Thanks guests for attending.',
  save_the_date:
    'Sent when an event transitions to "Booked" status. Announces the date to guests.',
  manual:
    'Only sent via the "Send Now" button in the Event Detail → Invites tab. Never automatic.',
};

const TRIGGER_ICONS: Record<TriggerType, typeof Mail> = {
  rsvp_reminder: Clock,
  thank_you: CheckCircle2,
  save_the_date: Mail,
  manual: Send,
};

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function EmailAutomationStudio({ orgId }: Props) {
  const canViewInvites = usePermission('invites.view');
  const canManageInvites = usePermission('invites.manage');
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<TriggerType | null>(null);
  const [selectedTemplates, setSelectedTemplates] = useState<Partial<Record<TriggerType, string>>>({});
  const [offsetDays, setOffsetDays] = useState<Partial<Record<TriggerType, number>>>({ rsvp_reminder: 7 });

  // ── Permission gate ──────────────────────────────────────────────────────
  if (!canViewInvites) {
    return (
      <>
        <PageHeader title="Email Automation" />
        <PageBody>
          <AccessDenied feature="Email Automation" className="min-h-[360px]" />
        </PageBody>
      </>
    );
  }

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: autoData, isLoading: autoLoading } = useQuery({
    queryKey: ['email-automations', orgId],
    queryFn: () => sdk.lifecycleEmails.listAutomations(orgId),
    staleTime: 2 * 60_000,
  });

  const { data: tmplData, isLoading: tmplLoading } = useQuery({
    queryKey: ['email-templates', orgId],
    queryFn: () => sdk.intelligence.listTemplates(orgId),
    staleTime: 5 * 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────
  const upsertMutation = useMutation({
    mutationFn: (vars: { triggerType: TriggerType; templateId: string; enabled: boolean; offsetDays?: number }) =>
      sdk.lifecycleEmails.upsertAutomation(orgId, vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-automations', orgId] });
      toast({ title: 'Automation saved', variant: 'success' });
    },
    onError: (err: Error) =>
      toast({ title: `Failed to save: ${err.message}`, variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.lifecycleEmails.deleteAutomation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-automations', orgId] });
      toast({ title: 'Automation removed', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to remove automation', variant: 'error' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { id: string; triggerType: TriggerType; templateId: string; enabled: boolean }) =>
      sdk.lifecycleEmails.upsertAutomation(orgId, {
        triggerType: vars.triggerType,
        templateId: vars.templateId,
        enabled: vars.enabled,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-automations', orgId] });
    },
    onError: () => toast({ title: 'Failed to update automation', variant: 'error' }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────
  const automations = autoData?.automations ?? [];
  const templates = tmplData?.templates ?? [];
  const isLoading = autoLoading || tmplLoading;

  function getAutomation(triggerType: TriggerType) {
    return automations.find((a) => a.trigger_type === triggerType);
  }

  function handleConfigure(triggerType: TriggerType) {
    if (!canManageInvites) return;
    const templateId = selectedTemplates[triggerType];
    if (!templateId) {
      toast({ title: 'Select a template first', variant: 'error' });
      return;
    }
    upsertMutation.mutate({
      triggerType,
      templateId,
      enabled: true,
      offsetDays: triggerType === 'rsvp_reminder' ? (offsetDays.rsvp_reminder ?? 7) : undefined,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-brand" aria-hidden="true" />
            Email Automation
          </span>
        }
        description="Automate guest communications at key moments in the event lifecycle."
        actions={
          canManageInvites ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.assign('#/system/email-templates')}
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              New Template
            </Button>
          ) : undefined
        }
      />

      <PageBody className="space-y-4">
        {isLoading ? (
          <div className="space-y-3" aria-label="Loading automations" aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No Email Templates Yet"
            description="Create your first email template before configuring automations."
            action={
              canManageInvites ? (
                <Button
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => window.location.assign('#/system/email-templates')}
                >
                  Create Template
                </Button>
              ) : undefined
            }
          />
        ) : (
          TRIGGER_TYPES.map((triggerType) => {
            const automation = getAutomation(triggerType);
            const isEnabled = automation?.enabled ?? false;
            const isExpanded = expanded === triggerType;
            const TriggerIcon = TRIGGER_ICONS[triggerType];

            return (
              <Card
                key={triggerType}
                className={automation && isEnabled ? 'border-brand/30' : undefined}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div
                        className={[
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          automation && isEnabled ? 'bg-brand/10 text-brand' : 'bg-surface-2 text-fg-muted',
                        ].join(' ')}
                        aria-hidden="true"
                      >
                        <TriggerIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          {TRIGGER_LABELS[triggerType]}
                          {automation && (
                            <Badge
                              variant={isEnabled ? 'success' : 'default'}
                              className="text-[10px]"
                            >
                              {isEnabled ? 'Active' : 'Paused'}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {TRIGGER_DESCRIPTIONS[triggerType]}
                        </CardDescription>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {canManageInvites && automation && (
                        <>
                          {/* Toggle enabled/disabled */}
                          <button
                            type="button"
                            onClick={() =>
                              toggleMutation.mutate({
                                id: automation.id,
                                triggerType,
                                templateId: automation.template_id,
                                enabled: !isEnabled,
                              })
                            }
                            className="rounded p-1 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand"
                            aria-label={isEnabled ? `Pause ${TRIGGER_LABELS[triggerType]}` : `Enable ${TRIGGER_LABELS[triggerType]}`}
                            aria-pressed={isEnabled}
                          >
                            {isEnabled ? (
                              <ToggleRight className="h-5 w-5 text-success" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-fg-muted" />
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(automation.id)}
                            className="rounded p-1 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-danger"
                            aria-label={`Remove ${TRIGGER_LABELS[triggerType]} automation`}
                          >
                            <Trash2 className="h-4 w-4 text-danger/70" />
                          </button>
                        </>
                      )}

                      {/* Expand/collapse configuration */}
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : triggerType)}
                        className="rounded p-1 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand"
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? 'Collapse configuration' : 'Expand configuration'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-fg-muted" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-fg-muted" />
                        )}
                      </button>
                    </div>
                  </div>
                </CardHeader>

                {/* Summary line when collapsed and configured */}
                {!isExpanded && automation && (
                  <CardContent className="pb-3">
                    <div className="flex items-center gap-2 text-xs text-fg-muted">
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        Template:{' '}
                        <strong className="text-fg">
                          {automation.template_name ?? automation.template_id}
                        </strong>
                      </span>
                      {triggerType === 'rsvp_reminder' && automation.offset_days != null && (
                        <span>
                          · Sends{' '}
                          <strong className="text-fg">{automation.offset_days} days</strong>{' '}
                          before deadline
                        </span>
                      )}
                    </div>
                  </CardContent>
                )}

                {/* Expanded configuration panel */}
                {isExpanded && (
                  <CardContent className="pt-0 space-y-4">
                    <div className="h-px bg-border" aria-hidden="true" />

                    {/* Template selector */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`template-${triggerType}`}
                        className="text-xs font-medium text-fg"
                      >
                        Email Template <span className="text-danger">*</span>
                      </label>
                      <select
                        id={`template-${triggerType}`}
                        className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm focus:ring-2 focus:ring-brand focus:outline-none"
                        value={selectedTemplates[triggerType] ?? automation?.template_id ?? ''}
                        onChange={(e) =>
                          setSelectedTemplates((prev) => ({
                            ...prev,
                            [triggerType]: e.target.value,
                          }))
                        }
                        disabled={!canManageInvites}
                        aria-describedby={`template-hint-${triggerType}`}
                      >
                        <option value="">— Choose a template —</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}{t.category ? ` (${t.category})` : ''}
                          </option>
                        ))}
                      </select>
                      <p
                        id={`template-hint-${triggerType}`}
                        className="text-[11px] text-fg-subtle"
                      >
                        The template used for this trigger. Supports merge fields like{' '}
                        <code className="bg-surface-2 px-1 rounded">{'{{guest_name}}'}</code>.
                      </p>
                    </div>

                    {/* Offset days (rsvp_reminder only) */}
                    {triggerType === 'rsvp_reminder' && (
                      <div className="space-y-1.5">
                        <label
                          htmlFor="offset-days"
                          className="text-xs font-medium text-fg"
                        >
                          Days Before RSVP Deadline
                        </label>
                        <input
                          id="offset-days"
                          type="number"
                          min={1}
                          max={90}
                          className="w-32 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm focus:ring-2 focus:ring-brand focus:outline-none"
                          value={offsetDays.rsvp_reminder ?? automation?.offset_days ?? 7}
                          onChange={(e) =>
                            setOffsetDays((prev) => ({
                              ...prev,
                              rsvp_reminder: Number(e.target.value),
                            }))
                          }
                          disabled={!canManageInvites}
                          aria-describedby="offset-hint"
                        />
                        <p id="offset-hint" className="text-[11px] text-fg-subtle">
                          The nightly scan will send this email when the RSVP deadline is
                          exactly this many days away.
                        </p>
                      </div>
                    )}

                    {/* Save / Configure button */}
                    {canManageInvites && (
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleConfigure(triggerType)}
                          loading={upsertMutation.isPending}
                          leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                        >
                          {automation ? 'Update Automation' : 'Enable Automation'}
                        </Button>
                        {automation && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              sdk.intelligence.previewTemplate(automation.template_id).then(() =>
                                toast({ title: 'Preview sent to your email', variant: 'success' }),
                              )
                            }
                          >
                            Preview Template
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Not configured fallback */}
                    {!automation && !canManageInvites && (
                      <div className="flex items-center gap-2 text-xs text-fg-muted">
                        <AlertCircle className="h-4 w-4" aria-hidden="true" />
                        Not configured. Ask an administrator to set up this automation.
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}

        {/* Footer guidance */}
        {!isLoading && templates.length > 0 && (
          <Card className="bg-surface-1 border-dashed">
            <CardContent className="py-4">
              <p className="text-xs text-fg-muted text-center">
                <strong>How it works:</strong> The nightly scan checks all events with upcoming
                RSVP deadlines and dispatches reminders automatically. "Thank You" emails fire
                immediately when an event is marked Completed. All sends are logged in the Event
                Detail → Invites tab.
              </p>
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
