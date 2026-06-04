import React, { useState } from 'react';
import { TeamMembers } from './TeamMembers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users, Shield, Database, Settings, Activity, Download, Upload, Server,
  Layers, Heart, HelpCircle, Palette, Sliders, PlayCircle
} from 'lucide-react';
import { PageBody, PageHeader } from '../../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/Tabs';
import { Button } from '../../../ui/Button';
import { useToast } from '../../../ui/Toast';
import { ControlPanel } from '../../../components/ControlPanel';
import { EventQuestionsStudio } from '../questions/EventQuestionsStudio';

// ─── Import unified workspaces from Catalog Screen for perfect DRY compliance ───
import {
  CatalogManager,
  VenueManager,
  DecorManager,
  BrandingManager,
  GuestPortalManager,
  AccessControlManager
} from '../../catalog/CatalogScreen';

interface Props {
  orgId: string;
}

type AdminTab = 'team' | 'permissions' | 'catalog' | 'decor' | 'venue' | 'questions' | 'branding' | 'guest_portal' | 'backups' | 'diagnostics';

export function AdminPanel({ orgId }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('team');

  return (
    <>
      <PageHeader
        title="Admin Settings & Operations"
        description="Universal operational suite for managing branding, team members, floorplan catalogs, florals, and database backups."
      />
      <PageBody>
        <Card className="min-h-[600px] flex flex-col shadow-lg border-border bg-[#FDFBF7]">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)} className="flex-1 flex flex-col">
            <div className="border-b border-border p-4 bg-surface-2/30 overflow-x-auto">
              <TabsList className="flex flex-nowrap gap-1">
                <TabsTrigger value="team" className="text-xs font-semibold"><Users className="w-3.5 h-3.5 mr-1.5" /> Team</TabsTrigger>
                <TabsTrigger value="permissions" className="text-xs font-semibold"><Shield className="w-3.5 h-3.5 mr-1.5" /> Permissions Matrix</TabsTrigger>
                <TabsTrigger value="catalog" className="text-xs font-semibold"><Layers className="w-3.5 h-3.5 mr-1.5" /> Structural Specs</TabsTrigger>
                <TabsTrigger value="decor" className="text-xs font-semibold"><Heart className="w-3.5 h-3.5 mr-1.5" /> Decor</TabsTrigger>
                <TabsTrigger value="venue" className="text-xs font-semibold"><Server className="w-3.5 h-3.5 mr-1.5" /> Venues</TabsTrigger>
                <TabsTrigger value="questions" className="text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Questions</TabsTrigger>
                <TabsTrigger value="branding" className="text-xs font-semibold"><Palette className="w-3.5 h-3.5 mr-1.5" /> Branding Studio</TabsTrigger>
                <TabsTrigger value="guest_portal" className="text-xs font-semibold"><Sliders className="w-3.5 h-3.5 mr-1.5" /> Guest Portal</TabsTrigger>
                <TabsTrigger value="backups" className="text-xs font-semibold"><Database className="w-3.5 h-3.5 mr-1.5" /> Backups</TabsTrigger>
                <TabsTrigger value="diagnostics" className="text-xs font-semibold"><Activity className="w-3.5 h-3.5 mr-1.5" /> Diagnostics</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 p-6 bg-surface-2/10">
              <TabsContent value="team" className="h-full m-0">
                <TeamMembers orgId={orgId} />
              </TabsContent>
              
              <TabsContent value="permissions" className="h-full m-0">
                <AccessControlManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="catalog" className="h-full m-0">
                <CatalogManager orgId={orgId} kind="table" />
              </TabsContent>

              <TabsContent value="decor" className="h-full m-0">
                <DecorManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="venue" className="h-full m-0">
                <VenueManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="questions" className="h-full m-0">
                <EventQuestionsStudio orgId={orgId} />
              </TabsContent>

              <TabsContent value="branding" className="h-full m-0">
                <BrandingManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="guest_portal" className="h-full m-0">
                <GuestPortalManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="backups" className="h-full m-0">
                <BackupManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="diagnostics" className="h-full m-0">
                <ControlPanel />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </PageBody>
    </>
  );
}

// ─── Backup Snapshot Archiver ────────────────────────────────────────────────
function BackupManager({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleExport = () => {
    setDownloading(true);
    toast({ title: 'Preparing Backup', description: 'Downloading your organization data...' });
    const link = document.createElement('a');
    link.href = `/api/orgs/${orgId}/export/backup.json`;
    link.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => {
      setDownloading(false);
      toast({ title: 'Backup Downloaded', variant: 'success' });
    }, 1000);
  };

  const handleImport = () => {
    toast({ title: 'Import restricted', description: 'Contact system administrator to restore from snapshot.', variant: 'destructive' });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-brand-soft/30 border border-brand/20 p-5 rounded-xl flex items-start gap-4">
        <Server className="w-6 h-6 text-brand shrink-0 mt-1" />
        <div>
           <h3 className="font-semibold text-fg font-serif">Database Snapshots</h3>
           <p className="text-xs text-fg-muted mt-1 leading-relaxed">
             Full operational data including Guests, Layouts, Configurations, and Chat threads are stored in isolated encrypted tenants. You can request a physical local backup of your environment for archival purposes.
           </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Card className="bg-white border-border/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Download className="w-4 h-4 text-brand"/> Export Data</CardTitle>
            <CardDescription className="text-xs text-fg-subtle">Download a complete JSON backup of all events, guests, vendors, and budget data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={downloading} onClick={handleExport}>
               {downloading ? 'Generating...' : 'Download Snapshot'}
            </Button>
            <p className="text-[10px] text-center text-fg-subtle mt-3">Includes events, guests, vendors, budget, and timeline data</p>
          </CardContent>
        </Card>

        <Card className="border-danger/20 bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-danger"><Upload className="w-4 h-4"/> Restore Backup</CardTitle>
            <CardDescription className="text-xs text-fg-subtle">Overwrites current active state with a previous binary file.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full" onClick={handleImport}>
               Upload & Restore
            </Button>
            <p className="text-[10px] text-center text-danger/70 mt-3 font-semibold">WARNING: This action is destructive.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
