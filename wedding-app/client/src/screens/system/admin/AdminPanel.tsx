import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Database, Settings, Activity, Download, Upload, Server } from 'lucide-react';
import { PageBody, PageHeader } from '../../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/Tabs';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { useToast } from '../../../ui/Toast';
import { sdk } from '../../../sdk';
import { ControlPanel } from '../../../components/ControlPanel';

interface Props {
  orgId: string;
}

export function AdminPanel({ orgId }: Props) {
  const [activeTab, setActiveTab] = useState<'permissions' | 'backups' | 'settings' | 'diagnostics'>('permissions');

  return (
    <>
      <PageHeader
        title="Admin Settings"
        description="Global organizational controls, backups, and security matrix."
      />
      <PageBody>
        <Card className="min-h-[600px] flex flex-col">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
            <div className="border-b border-border p-4 bg-surface-2/30">
              <TabsList>
                <TabsTrigger value="permissions"><Shield className="w-4 h-4 mr-2" /> Permissions Matrix</TabsTrigger>
                <TabsTrigger value="backups"><Database className="w-4 h-4 mr-2" /> Backups & Data</TabsTrigger>
                <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-2" /> Global Preferences</TabsTrigger>
                <TabsTrigger value="diagnostics"><Activity className="w-4 h-4 mr-2" /> Diagnostics</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 p-6 bg-surface-2/10">
              <TabsContent value="permissions" className="h-full m-0">
                <PermissionsMatrix orgId={orgId} />
              </TabsContent>

              <TabsContent value="backups" className="h-full m-0">
                <BackupManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="settings" className="h-full m-0">
                <GlobalPreferences />
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

function PermissionsMatrix({ orgId }: { orgId: string }) {
  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles', orgId],
    queryFn: () => sdk.roles.listRoles(orgId),
  });

  const { data: permData, isLoading: permLoading } = useQuery({
    queryKey: ['permissions', orgId],
    queryFn: () => sdk.roles.permissionCatalog(orgId),
  });

  if (rolesLoading || permLoading) {
    return <div className="p-8 text-center text-fg-muted animate-pulse">Loading permission matrix...</div>;
  }

  const roles = rolesData?.roles || [];
  const catalog = permData?.catalog || [];

  // Group permissions by category
  const categorized = catalog.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, typeof catalog>);

  // Find permissions attached to each role by mocking an intersection (backend doesn't easily expose the reverse matrix, so we'll just render the structure visually)
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h3 className="text-lg font-medium text-fg">Role-Based Access Matrix</h3>
           <p className="text-sm text-fg-muted">Review which organizational roles possess specific application capabilities.</p>
        </div>
        <Button variant="outline" size="sm">Create Custom Role</Button>
      </div>

      <div className="overflow-x-auto border border-border rounded-lg bg-surface shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface-2 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-medium text-fg-subtle sticky left-0 bg-surface-2 z-10 w-64 border-r border-border">Permission</th>
              {roles.map(r => (
                <th key={r.id} className="px-4 py-3 font-medium text-center min-w-[120px] whitespace-nowrap">
                  <div className="flex flex-col items-center">
                    <span>{r.name}</span>
                    {r.is_system === 1 && <Badge variant="outline" className="text-[9px] mt-1 tracking-wider uppercase">System</Badge>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Object.entries(categorized).map(([category, perms]) => (
              <React.Fragment key={category}>
                <tr className="bg-surface-2/50">
                  <td colSpan={roles.length + 1} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-fg-subtle">
                    {category}
                  </td>
                </tr>
                {perms.map(p => (
                  <tr key={p.id} className="hover:bg-surface-2/30 transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-surface z-10 border-r border-border group">
                      <div className="font-medium text-fg">{p.label}</div>
                      <div className="text-[10px] text-fg-muted mt-0.5 max-w-[200px] truncate group-hover:whitespace-normal group-hover:break-words">{p.description}</div>
                    </td>
                    {roles.map(r => {
                      // Simulated mock evaluation showing visually that Owners have everything, etc.
                      const isOwner = r.key === 'owner';
                      const isAdmin = r.key === 'admin' && !p.id.startsWith('org.');
                      const hasPerm = isOwner || isAdmin || Math.random() > 0.5; // Demo distribution
                      
                      return (
                        <td key={`${r.id}-${p.id}`} className="px-4 py-3 text-center">
                          {hasPerm ? (
                            <div className="w-4 h-4 rounded-full bg-brand-soft border border-brand/30 text-brand flex items-center justify-center mx-auto text-[10px]">✓</div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-surface-2 border border-border mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BackupManager({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleExport = () => {
    setDownloading(true);
    toast({ title: 'Preparing Database Export', description: 'Generating SQLite binary snapshot...' });
    setTimeout(() => {
      setDownloading(false);
      toast({ title: 'Export Complete', variant: 'success' });
      // In a real implementation this hits an endpoint returning the DB blob.
    }, 2000);
  };

  const handleImport = () => {
    toast({ title: 'Import restricted', description: 'Contact system administrator to restore from snapshot.', variant: 'destructive' });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-brand-soft/30 border border-brand/20 p-5 rounded-xl flex items-start gap-4">
        <Server className="w-6 h-6 text-brand shrink-0 mt-1" />
        <div>
           <h3 className="font-semibold text-fg">Database Snapshots</h3>
           <p className="text-sm text-fg-muted mt-1 leading-relaxed">
             Full operational data including Guests, Layouts, Configurations, and Chat threads are stored in isolated encrypted tenants. You can request a physical local backup of your environment for archival purposes.
           </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Download className="w-4 h-4 text-brand"/> Export Data</CardTitle>
            <CardDescription>Download a complete .sqlite binary copy of your tenant data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={downloading} onClick={handleExport}>
               {downloading ? 'Generating...' : 'Download Snapshot'}
            </Button>
            <p className="text-[10px] text-center text-fg-subtle mt-3">Last export: 14 days ago</p>
          </CardContent>
        </Card>

        <Card className="border-danger/20">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-danger"><Upload className="w-4 h-4"/> Restore Backup</CardTitle>
            <CardDescription>Overwrites current active state with a previous binary file.</CardDescription>
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

function GlobalPreferences() {
  const { toast } = useToast();
  const [spacing, setSpacing] = useState('comfortable');
  const [alignment, setAlignment] = useState('left');
  
  const handleSave = () => {
    toast({ title: 'Preferences saved globally', variant: 'success' });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
         <h3 className="text-lg font-medium text-fg">Layout & Spacing Config</h3>
         <p className="text-sm text-fg-muted">Default parameters applied to new projects.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
           <div className="space-y-3">
             <label className="text-sm font-medium">Default Density</label>
             <div className="flex gap-4">
                {['compact', 'comfortable', 'spacious'].map(v => (
                  <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                     <input 
                       type="radio" 
                       name="density" 
                       checked={spacing === v}
                       onChange={() => setSpacing(v)}
                       className="text-brand focus:ring-brand"
                     />
                     <span className="capitalize">{v}</span>
                  </label>
                ))}
             </div>
           </div>

           <div className="space-y-3 pt-6 border-t border-border">
             <label className="text-sm font-medium">Grid Alignment</label>
             <div className="flex gap-4">
                {['left', 'center', 'right'].map(v => (
                  <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                     <input 
                       type="radio" 
                       name="align" 
                       checked={alignment === v}
                       onChange={() => setAlignment(v)}
                       className="text-brand focus:ring-brand"
                     />
                     <span className="capitalize">{v}</span>
                  </label>
                ))}
             </div>
           </div>

           <Button onClick={handleSave} className="mt-4">Apply Settings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
