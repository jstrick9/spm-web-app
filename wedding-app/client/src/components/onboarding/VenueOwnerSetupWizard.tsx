import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Building2, Check, ChevronLeft, ChevronRight, ClipboardList, Palette, Plus, Settings, Table2, UploadCloud, UserPlus } from 'lucide-react';
import { sdk } from '../../sdk';
import type { PartialPlatformConfig } from '../../config/schema';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../ui/Dialog';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { useToast } from '../../ui/Toast';
import { cn } from '../../ui/lib/cn';
import { parseCsv } from '../../lib/csv';

type StepId = 'identity' | 'spaces' | 'rules' | 'catalog' | 'firstEvent';

interface Props {
  orgId: string;
  open: boolean;
  initialConfig?: PartialPlatformConfig;
  onOpenChange: (open: boolean) => void;
  onSaved: (config: PartialPlatformConfig) => void;
}

const STEPS: Array<{ id: StepId; title: string; icon: typeof Palette }> = [
  { id: 'identity', title: 'Venue identity', icon: Palette },
  { id: 'spaces', title: 'Venue spaces', icon: Building2 },
  { id: 'rules', title: 'Capacity & rules', icon: Settings },
  { id: 'catalog', title: 'Catalog basics', icon: Table2 },
  { id: 'firstEvent', title: 'First event', icon: Plus },
];

const EMPTY_FORM = {
  venueName: '', logoUrl: '', brandColor: '#4A1942', supportEmail: '', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York', websiteUrl: '', instagramUrl: '', facebookUrl: '',
  ceremonySpace: '', receptionSpace: '', cocktailSpace: '', rainBackupSpace: '', gettingReadySuites: '', lodging: '',
  maxSeatedCapacity: '', maxStandingCapacity: '', noiseCutoff: '', alcoholRules: '', preferredVendorPolicy: '', loadInWindow: '', loadOutWindow: '',
  tables: true, chairs: true, linens: true, arbors: true, danceFloor: true, powerOutlets: true,
  firstEventMode: 'sample' as 'sample' | 'import_later' | 'none', firstEventTitle: 'Sample Wedding', firstEventDate: '',
};

export function VenueOwnerSetupWizard({ orgId, open, initialConfig, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [postSetupMode, setPostSetupMode] = useState<'none' | 'team'>('none');
  const [inviteRows, setInviteRows] = useState<Array<{ email: string; roleId: string }>>([{ email: '', roleId: '' }]);
  const [importKind, setImportKind] = useState<'events' | 'guests' | 'vendors'>('events');
  const [importRows, setImportRows] = useState<string[][]>([]);
  const [importMapping, setImportMapping] = useState<Record<number, string>>({});
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const step = STEPS[stepIndex];
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  const existingSetup = (initialConfig as any)?.setup?.ownerSetup;
  const completedSteps = useMemo(() => existingSetup?.completedSteps ?? [], [existingSetup]);
  const rolesQuery = useQuery({
    queryKey: ['setup-roles', orgId],
    queryFn: () => sdk.roles.listRoles(orgId),
    enabled: open,
  });

  const handleImportFile = async (file: File) => {
    setImportError(null);
    setImportResult(null);
    const rows = parseCsv(await file.text()).filter((row) => row.some((cell) => cell.trim()));
    if (rows.length < 2) {
      setImportRows([]);
      setImportError('Upload a CSV with a header row and at least one data row.');
      return;
    }
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const guesses: Record<number, string> = {};
    headers.forEach((h, i) => {
      if (['title', 'event title', 'event', 'name', 'couple'].includes(h)) guesses[i] = importKind === 'vendors' ? 'name' : importKind === 'guests' ? 'fullName' : 'title';
      if (['full name', 'guest name', 'guest'].includes(h)) guesses[i] = 'fullName';
      if (['vendor', 'vendor name', 'company'].includes(h)) guesses[i] = 'name';
      if (['date', 'start date', 'event date', 'start_date'].includes(h)) guesses[i] = 'startDate';
      if (['email', 'email address'].includes(h)) guesses[i] = 'email';
      if (['phone', 'phone number'].includes(h)) guesses[i] = 'phone';
      if (['category', 'type'].includes(h)) guesses[i] = 'category';
      if (['contact', 'contact name', 'primary contact'].includes(h)) guesses[i] = 'contactName';
      if (['party', 'party name', 'household'].includes(h)) guesses[i] = 'partyName';
      if (['rsvp', 'rsvp status', 'status'].includes(h)) guesses[i] = importKind === 'events' ? 'status' : 'rsvpStatus';
      if (['guest count', 'guests', 'guest_count'].includes(h)) guesses[i] = 'guestCount';
    });
    setImportMapping(guesses);
    setImportRows(rows.slice(0, 501));
  };

  const processSetupImport = async (fallbackEventId?: string): Promise<void> => {
    if (importRows.length < 2) return;
    const headers = importRows[0].map((h) => h.trim().toLowerCase());
    const dataRows = importRows.slice(1);
    const value = (row: string[], names: string[], mappedField?: string) => {
      const mappedIdx = mappedField ? Object.entries(importMapping).find(([, field]) => field === mappedField)?.[0] : undefined;
      if (mappedIdx !== undefined) return row[Number(mappedIdx)]?.trim() ?? '';
      const idx = headers.findIndex((h) => names.includes(h));
      return idx >= 0 ? row[idx]?.trim() ?? '' : '';
    };

    if (importKind === 'events') {
      let count = 0;
      for (const row of dataRows) {
        const title = value(row, ['title', 'event title', 'event', 'name', 'couple'], 'title');
        if (!title) continue;
        await sdk.events.create({
          organizationId: orgId,
          title,
          startDate: value(row, ['date', 'start date', 'event date', 'start_date'], 'startDate') || undefined,
          status: (value(row, ['status'], 'status') || 'planning') as any,
          guestCount: Number(value(row, ['guest count', 'guests', 'guest_count'], 'guestCount')) || undefined,
        });
        count++;
      }
      setImportResult(`Imported ${count} event${count === 1 ? '' : 's'} from spreadsheet.`);
      return;
    }

    if (importKind === 'vendors') {
      let count = 0;
      for (const row of dataRows) {
        const name = value(row, ['name', 'vendor', 'vendor name', 'company'], 'name');
        if (!name) continue;
        await sdk.vendors.create(orgId, {
          name,
          category: value(row, ['category', 'type'], 'category') || 'General',
          contactName: value(row, ['contact', 'contact name', 'primary contact'], 'contactName') || undefined,
          email: value(row, ['email', 'email address'], 'email') || undefined,
          phone: value(row, ['phone', 'phone number'], 'phone') || undefined,
          websiteUrl: value(row, ['website', 'url', 'website url'], 'websiteUrl') || undefined,
          isPreferred: ['yes', 'true', '1', 'preferred'].includes(value(row, ['preferred', 'is preferred'], 'preferred').toLowerCase()),
        });
        count++;
      }
      setImportResult(`Imported ${count} vendor${count === 1 ? '' : 's'} from spreadsheet.`);
      return;
    }

    let eventId = fallbackEventId;
    if (!eventId) {
      const created = await sdk.events.create({
        organizationId: orgId,
        title: form.firstEventTitle || 'Imported Wedding',
        startDate: form.firstEventDate || undefined,
        guestCount: dataRows.length,
      });
      eventId = created.event.id;
    }
    const guests = dataRows.map((row) => ({
      fullName: value(row, ['full name', 'name', 'guest name', 'guest'], 'fullName') || '',
      email: value(row, ['email', 'email address'], 'email') || undefined,
      phone: value(row, ['phone', 'phone number'], 'phone') || undefined,
      partyName: value(row, ['party', 'party name', 'household'], 'partyName') || undefined,
      rsvpStatus: (value(row, ['rsvp', 'rsvp status', 'status'], 'rsvpStatus') || 'pending') as any,
    })).filter((guest) => guest.fullName);
    if (guests.length) {
      const res = await sdk.guests.bulkCreate(eventId, 'skip', guests);
      setImportResult(`Imported ${res.inserted} guests; skipped ${res.skipped}.`);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (status: 'skipped' | 'completed') => {
      const nextConfig: PartialPlatformConfig = {
        ...(initialConfig ?? {}),
        branding: {
          ...(initialConfig?.branding ?? {}),
          platformName: form.venueName || initialConfig?.branding?.platformName || 'Wedding Venue Intelligence',
          logoUrl: form.logoUrl,
          supportEmail: form.supportEmail,
          brandColor: form.brandColor,
        },
        setup: {
          ownerSetup: {
            status,
            completedSteps: status === 'completed' ? STEPS.map(s => s.id) : completedSteps,
            skippedAt: status === 'skipped' ? new Date().toISOString() : existingSetup?.skippedAt,
            completedAt: status === 'completed' ? new Date().toISOString() : existingSetup?.completedAt,
            identity: {
              venueName: form.venueName, logoUrl: form.logoUrl, brandColor: form.brandColor,
              supportEmail: form.supportEmail, timeZone: form.timeZone, websiteUrl: form.websiteUrl,
              instagramUrl: form.instagramUrl, facebookUrl: form.facebookUrl,
            },
            spaces: {
              ceremonySpace: form.ceremonySpace, receptionSpace: form.receptionSpace,
              cocktailSpace: form.cocktailSpace, rainBackupSpace: form.rainBackupSpace,
              gettingReadySuites: form.gettingReadySuites, lodging: form.lodging,
            },
            rules: {
              maxSeatedCapacity: Number(form.maxSeatedCapacity) || null,
              maxStandingCapacity: Number(form.maxStandingCapacity) || null,
              noiseCutoff: form.noiseCutoff, alcoholRules: form.alcoholRules,
              preferredVendorPolicy: form.preferredVendorPolicy,
              loadInWindow: form.loadInWindow, loadOutWindow: form.loadOutWindow,
            },
            catalog: {
              tables: form.tables, chairs: form.chairs, linens: form.linens, arbors: form.arbors,
              danceFloor: form.danceFloor, powerOutlets: form.powerOutlets,
            },
            firstEvent: {
              mode: form.firstEventMode,
              title: form.firstEventTitle,
              date: form.firstEventDate,
              importSpreadsheetRequested: localStorage.getItem('wvi_onboarding_import_spreadsheet') === 'true',
            },
            registration: {
              role: localStorage.getItem('wvi_registration_role') || 'venue_owner',
              inviteTeamAfterSetup: localStorage.getItem('wvi_post_setup_invite_team') === 'true',
            },
          },
        } as any,
      } as PartialPlatformConfig;

      const saved = await sdk.platformConfig.putOrg(orgId, nextConfig);

      let firstEventId: string | undefined;
      if (status === 'completed' && form.firstEventMode === 'sample') {
        const created = await sdk.events.create({
          organizationId: orgId,
          title: form.firstEventTitle || 'Sample Wedding',
          startDate: form.firstEventDate || undefined,
          guestCount: Number(form.maxSeatedCapacity) ? Math.min(Number(form.maxSeatedCapacity), 120) : 100,
        });
        firstEventId = created.event.id;
      }

      if (status === 'completed') {
        await processSetupImport(firstEventId);
      }

      return saved.config;
    },
    onSuccess: (config, status) => {
      onSaved(config);
      localStorage.removeItem('wvi_show_owner_setup');
      const inviteTeam = localStorage.getItem('wvi_post_setup_invite_team') === 'true';
      const importSpreadsheet = localStorage.getItem('wvi_onboarding_import_spreadsheet') === 'true';
      toast({
        title: status === 'completed' ? 'Venue setup saved' : 'Setup skipped for now',
        description: status === 'completed'
          ? inviteTeam
            ? 'Next: invite planners, coordinators, or staff before entering the full workspace.'
            : importSpreadsheet
              ? importResult || 'Spreadsheet import preferences are saved.'
              : 'Your owner setup checklist is complete.'
          : 'You can restart the setup wizard from Platform Studio.',
        variant: 'success',
      });
      if (status === 'completed' && inviteTeam) {
        setPostSetupMode('team');
      } else {
        onOpenChange(false);
      }
    },
    onError: (e: any) => toast({ title: 'Could not save setup', description: e.message, variant: 'destructive' }),
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const rows = inviteRows.filter((row) => row.email.trim() && row.roleId);
      for (const row of rows) {
        await sdk.roles.inviteMember(orgId, { email: row.email.trim(), roleId: row.roleId });
      }
      return rows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['members', orgId] });
      toast({ title: count ? 'Team invites added' : 'Team invite skipped', description: count ? `${count} team member${count === 1 ? '' : 's'} added to your workspace.` : 'You can invite your team later from Admin → Team Members.', variant: 'success' });
      localStorage.removeItem('wvi_post_setup_invite_team');
      setPostSetupMode('none');
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: 'Could not invite team member', description: e?.message?.includes('not-found') ? 'The user must create an account before they can be added.' : e.message, variant: 'destructive' }),
  });

  const update = (key: keyof typeof EMPTY_FORM, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  if (postSetupMode === 'team') {
    return (
      <Dialog open={open} onOpenChange={(next) => { if (!next) { setPostSetupMode('none'); onOpenChange(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="text-xl font-display text-brand flex items-center gap-2"><UserPlus className="h-5 w-5" /> Invite your team</DialogTitle>
          <DialogDescription>Add planners, coordinators, and staff now so they can help complete your first event. Users must have registered accounts before they can be added.</DialogDescription>
          <div className="space-y-3 py-3">
            {inviteRows.map((row, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <Input type="email" placeholder="planner@example.com" value={row.email} onChange={(e) => setInviteRows((rows) => rows.map((r, i) => i === index ? { ...r, email: e.target.value } : r))} />
                <select className="h-10 rounded-md border border-border bg-surface px-3 text-sm" value={row.roleId} onChange={(e) => setInviteRows((rows) => rows.map((r, i) => i === index ? { ...r, roleId: e.target.value } : r))} aria-label="Team role">
                  <option value="">Select role</option>
                  {(rolesQuery.data?.roles ?? []).filter((role: any) => role.key !== 'owner').map((role: any) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
                <Button type="button" variant="ghost" onClick={() => setInviteRows((rows) => rows.filter((_, i) => i !== index))} disabled={inviteRows.length === 1}>Remove</Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setInviteRows((rows) => [...rows, { email: '', roleId: '' }])}>Add another teammate</Button>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => { localStorage.removeItem('wvi_post_setup_invite_team'); setPostSetupMode('none'); onOpenChange(false); }}>Skip for now</Button>
            <Button onClick={() => inviteMutation.mutate()} isLoading={inviteMutation.isPending}>Finish and enter workspace</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="border-b border-border bg-surface-2 p-5">
          <DialogTitle className="text-xl font-display text-brand">Venue Owner Setup Wizard</DialogTitle>
          <DialogDescription>Set up the essentials so your team can create events, portals, layouts, and readiness checks with confidence.</DialogDescription>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-fg-muted mb-1">
              <span>Venue setup {progress}% complete</span>
              <span>Step {stepIndex + 1} of {STEPS.length}</span>
            </div>
            <div className="h-2 rounded-full bg-surface overflow-hidden"><div className="h-full bg-brand" style={{ width: `${progress}%` }} /></div>
          </div>
        </div>

        <div className="grid md:grid-cols-[220px_1fr] min-h-[470px]">
          <aside className="border-r border-border bg-surface-2/50 p-4 space-y-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <button key={s.id} type="button" onClick={() => setStepIndex(i)} className={cn('w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm', i === stepIndex ? 'bg-brand-soft text-brand font-semibold' : 'text-fg-muted hover:bg-surface')}>
                  <Icon className="h-4 w-4" /> {s.title}
                  {i < stepIndex && <Check className="ml-auto h-3.5 w-3.5 text-success" />}
                </button>
              );
            })}
          </aside>

          <main className="p-6 overflow-y-auto">
            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                {step.id === 'identity' && <IdentityStep form={form} update={update} />}
                {step.id === 'spaces' && <SpacesStep form={form} update={update} />}
                {step.id === 'rules' && <RulesStep form={form} update={update} />}
                {step.id === 'catalog' && <CatalogStep form={form} update={update} />}
                {step.id === 'firstEvent' && <FirstEventStep form={form} update={update} importKind={importKind} setImportKind={setImportKind} importRows={importRows} importMapping={importMapping} setImportMapping={setImportMapping} importResult={importResult} importError={importError} onImportFile={handleImportFile} />}
              </CardContent>
            </Card>
          </main>
        </div>

        <div className="border-t border-border bg-surface p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={() => saveMutation.mutate('skipped')} disabled={saveMutation.isPending}>Skip for now</Button>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" disabled={stepIndex === 0 || saveMutation.isPending} onClick={() => setStepIndex(i => Math.max(0, i - 1))}><ChevronLeft className="h-4 w-4" /> Back</Button>
            {stepIndex < STEPS.length - 1 ? (
              <Button onClick={() => setStepIndex(i => Math.min(STEPS.length - 1, i + 1))}>Next <ChevronRight className="h-4 w-4" /></Button>
            ) : (
              <Button onClick={() => saveMutation.mutate('completed')} isLoading={saveMutation.isPending}>Finish setup</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-bold uppercase text-fg-subtle">{label}</Label>{children}</div>;
}

function IdentityStep({ form, update }: any) {
  return <div className="space-y-4"><h3 className="font-semibold text-fg">Venue identity</h3><div className="grid gap-3 sm:grid-cols-2">
    <Field label="Venue name"><Input value={form.venueName} onChange={(e) => update('venueName', e.target.value)} placeholder="Willow Creek Estate" /></Field>
    <Field label="Logo URL"><Input value={form.logoUrl} onChange={(e) => update('logoUrl', e.target.value)} placeholder="https://..." /></Field>
    <Field label="Brand color"><Input type="color" value={form.brandColor} onChange={(e) => update('brandColor', e.target.value)} /></Field>
    <Field label="Support email"><Input type="email" value={form.supportEmail} onChange={(e) => update('supportEmail', e.target.value)} placeholder="hello@venue.com" /></Field>
    <Field label="Time zone"><Input value={form.timeZone} onChange={(e) => update('timeZone', e.target.value)} /></Field>
    <Field label="Website"><Input value={form.websiteUrl} onChange={(e) => update('websiteUrl', e.target.value)} placeholder="https://venue.com" /></Field>
    <Field label="Instagram"><Input value={form.instagramUrl} onChange={(e) => update('instagramUrl', e.target.value)} placeholder="https://instagram.com/..." /></Field>
    <Field label="Facebook"><Input value={form.facebookUrl} onChange={(e) => update('facebookUrl', e.target.value)} placeholder="https://facebook.com/..." /></Field>
  </div></div>;
}
function SpacesStep({ form, update }: any) {
  return <div className="space-y-4"><h3 className="font-semibold text-fg">Venue spaces</h3><div className="grid gap-3 sm:grid-cols-2">
    {[
      ['ceremonySpace','Ceremony space'], ['receptionSpace','Reception space'], ['cocktailSpace','Cocktail hour space'],
      ['rainBackupSpace','Rain/backup space'], ['gettingReadySuites','Getting-ready suites'], ['lodging','Lodging/cabins'],
    ].map(([key, label]) => <Field key={key} label={label}><Input value={form[key]} onChange={(e) => update(key, e.target.value)} placeholder={label} /></Field>)}
  </div></div>;
}
function RulesStep({ form, update }: any) {
  return <div className="space-y-4"><h3 className="font-semibold text-fg">Capacity and rules</h3><div className="grid gap-3 sm:grid-cols-2">
    <Field label="Max seated capacity"><Input type="number" value={form.maxSeatedCapacity} onChange={(e) => update('maxSeatedCapacity', e.target.value)} /></Field>
    <Field label="Max standing capacity"><Input type="number" value={form.maxStandingCapacity} onChange={(e) => update('maxStandingCapacity', e.target.value)} /></Field>
    <Field label="Noise cutoff"><Input value={form.noiseCutoff} onChange={(e) => update('noiseCutoff', e.target.value)} placeholder="10:00 PM" /></Field>
    <Field label="Preferred vendor policy"><Input value={form.preferredVendorPolicy} onChange={(e) => update('preferredVendorPolicy', e.target.value)} placeholder="Preferred list required / flexible" /></Field>
    <Field label="Load-in window"><Input value={form.loadInWindow} onChange={(e) => update('loadInWindow', e.target.value)} placeholder="10:00 AM – 2:00 PM" /></Field>
    <Field label="Load-out window"><Input value={form.loadOutWindow} onChange={(e) => update('loadOutWindow', e.target.value)} placeholder="10:00 PM – midnight" /></Field>
    <div className="sm:col-span-2"><Field label="Alcohol rules"><Input value={form.alcoholRules} onChange={(e) => update('alcoholRules', e.target.value)} placeholder="Licensed bartenders only, last call at..." /></Field></div>
  </div></div>;
}
function CatalogStep({ form, update }: any) {
  const fields = [['tables','Tables'], ['chairs','Chairs'], ['linens','Linens'], ['arbors','Arbors / ceremony fixtures'], ['danceFloor','Dance floor'], ['powerOutlets','Power outlets / vendor zones']];
  return <div className="space-y-4"><h3 className="font-semibold text-fg">Catalog basics</h3><p className="text-sm text-fg-muted">Select the basics your venue uses. You can add exact quantities/dimensions later in Catalog Studio.</p><div className="grid gap-2 sm:grid-cols-2">
    {fields.map(([key, label]) => <label key={key} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={form[key]} onChange={(e) => update(key, e.target.checked)} className="accent-brand" />{label}</label>)}
  </div></div>;
}
function FirstEventStep({ form, update, importKind, setImportKind, importRows, importMapping, setImportMapping, importResult, importError, onImportFile }: any) {
  const importRequested = localStorage.getItem('wvi_onboarding_import_spreadsheet') === 'true';
  const inviteTeam = localStorage.getItem('wvi_post_setup_invite_team') === 'true';
  const headers = importRows?.[0] ?? [];
  const previewRows = (importRows ?? []).slice(1, 6);
  return <div className="space-y-4"><h3 className="font-semibold text-fg">Create a first sample event or import real data</h3><div className="space-y-2">
    <label className="flex gap-2"><input type="radio" checked={form.firstEventMode === 'sample'} onChange={() => update('firstEventMode', 'sample')} /> Create a sample wedding so I can learn the workflow</label>
    <label className="flex gap-2"><input type="radio" checked={form.firstEventMode === 'import_later'} onChange={() => update('firstEventMode', 'import_later')} /> I’ll import or create my real events later</label>
  </div>{form.firstEventMode === 'sample' && <div className="grid gap-3 sm:grid-cols-2"><Field label="Sample event title"><Input value={form.firstEventTitle} onChange={(e) => update('firstEventTitle', e.target.value)} /></Field><Field label="Sample event date"><Input type="date" value={form.firstEventDate} onChange={(e) => update('firstEventDate', e.target.value)} /></Field></div>}

  <div className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
    <div className="flex items-start gap-2">
      <UploadCloud className="h-4 w-4 mt-0.5 text-brand" />
      <div>
        <div className="text-sm font-semibold text-fg">Import from spreadsheet during setup</div>
        <p className="text-xs text-fg-muted">Upload CSV data for events, guests, or vendors now. Headers are matched by common names such as “Event Title”, “Full Name”, “Vendor Name”, “Email”, and “Phone”.</p>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
      <select className="h-10 rounded-md border border-border bg-surface px-3 text-sm" value={importKind} onChange={(e) => setImportKind(e.target.value)} aria-label="Spreadsheet import type">
        <option value="events">Events</option>
        <option value="guests">Guests</option>
        <option value="vendors">Vendors</option>
      </select>
      <Input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])} />
    </div>
    {importError && <div className="flex gap-2 rounded-lg border border-danger/20 bg-danger-soft p-2 text-xs text-danger"><AlertTriangle className="h-4 w-4" /> {importError}</div>}
    {headers.length > 0 && <div className="grid gap-2 sm:grid-cols-2">
      {headers.map((h: string, i: number) => <label key={i} className="text-xs"><span className="font-semibold text-fg">{h}</span><select className="mt-1 h-8 w-full rounded border border-border bg-surface px-2" value={importMapping[i] ?? ''} onChange={(e) => setImportMapping((m: Record<number,string>) => ({ ...m, [i]: e.target.value }))}><option value="">Do not import</option>{(importKind === 'events' ? ['title','startDate','status','guestCount'] : importKind === 'guests' ? ['fullName','email','phone','partyName','rsvpStatus'] : ['name','category','contactName','email','phone','websiteUrl','preferred']).map(f => <option key={f} value={f}>{f}</option>)}</select></label>)}
    </div>}
    {headers.length > 0 && <div className="overflow-auto rounded-lg border border-border bg-surface text-xs">
      <table className="min-w-full"><thead><tr>{headers.map((h: string, i: number) => <th key={i} className="border-b border-border px-2 py-1 text-left font-semibold">{h}</th>)}</tr></thead><tbody>{previewRows.map((row: string[], i: number) => <tr key={i}>{headers.map((_: string, j: number) => <td key={j} className="border-b border-border/60 px-2 py-1 text-fg-muted">{row[j]}</td>)}</tr>)}</tbody></table>
      <div className="px-2 py-1 text-fg-subtle">{Math.max(0, importRows.length - 1)} data row{importRows.length === 2 ? '' : 's'} ready to import when you finish setup.</div>
    </div>}
    {importResult && <p className="text-xs font-semibold text-success">{importResult}</p>}
  </div>

  {(importRequested || inviteTeam) && <div className="rounded-lg border border-brand/20 bg-brand-soft/30 p-3 text-xs text-brand/90 space-y-1">
    {importRequested && <p><strong>Spreadsheet import preference saved.</strong> You can complete it here now or continue later from the relevant module.</p>}
    {inviteTeam && <p><strong>Team invite step enabled.</strong> After setup, you’ll get a dedicated invite screen before entering the workspace.</p>}
  </div>}</div>;
}
