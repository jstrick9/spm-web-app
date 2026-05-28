import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Globe, Lock, Key, Link as LinkIcon, Save, ExternalLink } from 'lucide-react';
import { sdk } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { useToast } from '../../../ui/Toast';
import { Skeleton } from '../../../ui/Skeleton';
import { cn } from '../../../ui/lib/cn';

interface Props {
  eventId: string;
}

export function GuestPortalSettingsTab({ eventId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const [localEnabled, setLocalEnabled] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['portalConfig', eventId],
    queryFn: () => sdk.guests.getPortalConfig(eventId),
  });

  // Initialize state once loaded
  React.useEffect(() => {
    if (data && data.config) {
      setLocalEnabled(data.config.enabled === 1);
      setHasPassword(!!data.config.password_hash);
      setIsDirty(false);
      setNewPassword('');
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => {
       const payload: any = { enabled: localEnabled };
       if (newPassword) payload.password = newPassword;
       else if (!hasPassword) payload.clearPassword = true;
       return sdk.guests.updatePortalConfig(eventId, payload);
    },
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ['portalConfig', eventId] });
       toast({ title: 'Portal settings saved', variant: 'success' });
       setIsDirty(false);
       setNewPassword('');
    },
    onError: (e: any) => {
       toast({ title: 'Failed to save settings', description: e.message, variant: 'destructive' });
    }
  });

  const handleToggleEnable = () => {
    setLocalEnabled(!localEnabled);
    setIsDirty(true);
  };
  
  const handleTogglePassword = () => {
     setHasPassword(!hasPassword);
     if (hasPassword) setNewPassword(''); // clearing
     setIsDirty(true);
  };

  const portalUrl = `${window.location.origin}/#/portal/${eventId}`;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-brand" /> Public Guest Portal
            </CardTitle>
            <CardDescription className="mt-1">
              Configure the public-facing RSVP and logistics portal for invited guests.
            </CardDescription>
          </div>
          
          <button 
             type="button"
             onClick={handleToggleEnable}
             className={cn(
               "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
               localEnabled ? "bg-success" : "bg-surface-2"
             )}
          >
             <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                localEnabled ? "translate-x-6" : "translate-x-1"
             )} />
          </button>
        </CardHeader>
        
        <CardContent className="space-y-6 border-t border-border pt-6">
           <div className="bg-surface-2/50 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border border-border">
              <div>
                <Label className="flex items-center gap-2 mb-1">
                   <LinkIcon className="w-4 h-4 text-fg-muted" /> Shareable Link
                </Label>
                <div className="text-sm font-mono text-fg-subtle select-all bg-surface px-3 py-1.5 rounded border border-border">
                   {portalUrl}
                </div>
              </div>
              <div className="flex gap-2">
                 <Button 
                   variant="outline" 
                   onClick={() => {
                     navigator.clipboard.writeText(portalUrl);
                     toast({ title: 'Link copied to clipboard' });
                   }}
                 >
                   Copy URL
                 </Button>
                 <a href={portalUrl} target="_blank" rel="noreferrer">
                   <Button variant="secondary"><ExternalLink className="w-4 h-4 mr-1" /> Visit</Button>
                 </a>
              </div>
           </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
           <CardTitle className="text-base flex items-center gap-2">
             <Lock className="w-4 h-4 text-brand" /> Access & Security
           </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
           
           <div className="flex items-start gap-3">
              <input 
                 type="checkbox" 
                 id="pwd-gate"
                 checked={hasPassword}
                 onChange={handleTogglePassword}
                 className="mt-1"
              />
              <div className="flex-1">
                 <Label htmlFor="pwd-gate" className="font-medium cursor-pointer">Require a master password</Label>
                 <p className="text-sm text-fg-muted mt-1 mb-3">Guests will need to enter this shared password to view the event details and access the RSVP form.</p>
                 
                 {hasPassword && (
                   <div className="max-w-xs space-y-2">
                      <Label>Set Password</Label>
                      <Input 
                         type="text" 
                         placeholder="e.g. Smith2026" 
                         value={newPassword}
                         onChange={(e) => {
                            setNewPassword(e.target.value);
                            setIsDirty(true);
                         }}
                      />
                      {data?.config?.password_hash && !newPassword && (
                        <p className="text-xs text-success">A password is currently set. Type a new one to replace it.</p>
                      )}
                   </div>
                 )}
              </div>
           </div>
           
        </CardContent>
      </Card>
      
      {isDirty && (
        <div className="flex items-center justify-between p-4 bg-surface-2 border border-border rounded-lg shadow-sm animate-in slide-in-from-bottom-4 sticky bottom-4">
           <div className="text-sm font-medium">Unsaved changes</div>
           <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                 setLocalEnabled(data?.config?.enabled === 1);
                 setHasPassword(!!data?.config?.password_hash);
                 setNewPassword('');
                 setIsDirty(false);
              }}>Discard</Button>
              <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                 {mutation.isPending ? 'Saving...' : <><Save className="w-4 h-4 mr-1" /> Save Settings</>}
              </Button>
           </div>
        </div>
      )}
    </div>
  );
}
