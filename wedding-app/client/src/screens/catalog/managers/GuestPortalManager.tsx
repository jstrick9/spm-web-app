import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Plus, Save, Trash2, Heart, Shield, Palette, Settings, Sparkles,
  Check, Upload, Image as ImageIcon, Trash, Sliders, Info, Eye, Lock,
  Music, Utensils, Link as LinkIcon, Compass, Users, CheckSquare, XSquare,
  HelpCircle, ChevronRight, Activity, Calendar, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { sdk } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { Skeleton } from '../../../ui/Skeleton';
import { useToast } from '../../../ui/Toast';

export function GuestPortalManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: configData, isLoading } = useQuery({
    queryKey: ['platformConfig', orgId],
    queryFn: () => sdk.platformConfig.getOrg(orgId),
  });

  const [requirePasscode, setRequirePasscode] = useState(true);
  const [showMeals, setShowMeals] = useState(true);
  const [allowSongs, setAllowSongs] = useState(true);
  const [enableRegistry, setEnableRegistry] = useState(true);
  const [registryUrl, setRegistryUrl] = useState('https://withjoy.com/smith-wedding');
  const [expiryDays, setExpiryDays] = useState(60);
  const [lodgingRooms, setLodgingRooms] = useState(8);
  const [portalWelcome, setPortalWelcome] = useState('Welcome to our digital layout assistant.');

  // White-Label States (Phase 4)
  const [removePlatformBranding, setRemovePlatformBranding] = useState(false);
  const [customCopyrightString, setCustomCopyrightString] = useState('');
  const [mapDirectionsLink, setMapDirectionsLink] = useState('');
  const [supportEmailOverride, setSupportEmailOverride] = useState('');

  // Initialize state from fetched config
  React.useEffect(() => {
    if (configData?.config) {
      const portal = (configData.config as any).guestPortal;
      if (portal) {
        setRequirePasscode(portal.requirePasscode ?? true);
        setShowMeals(portal.showMeals ?? true);
        setAllowSongs(portal.allowSongs ?? true);
        setEnableRegistry(portal.enableRegistry ?? true);
        setRegistryUrl(portal.registryUrl ?? 'https://withjoy.com/smith-wedding');
        setExpiryDays(portal.expiryDays ?? 60);
        setLodgingRooms(portal.lodgingRooms ?? 8);
        setPortalWelcome(portal.portalWelcome ?? 'Welcome to our digital layout assistant.');
        setRemovePlatformBranding(portal.removePlatformBranding ?? false);
        setCustomCopyrightString(portal.customCopyrightString || '');
        setMapDirectionsLink(portal.mapDirectionsLink || '');
        setSupportEmailOverride(portal.supportEmailOverride || '');
      }
    }
  }, [configData]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const currentConfig = configData?.config || {};
      const updatedConfig = {
        ...currentConfig,
        guestPortal: {
          requirePasscode,
          showMeals,
          allowSongs,
          enableRegistry,
          registryUrl,
          expiryDays,
          lodgingRooms,
          portalWelcome,
          removePlatformBranding,
          customCopyrightString,
          mapDirectionsLink,
          supportEmailOverride,
        },
      };
      return sdk.platformConfig.putOrg(orgId, updatedConfig);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platformConfig', orgId] });
      toast({ title: 'Guest Portal preferences saved', variant: 'success' });
    },
    onError: (e: any) => {
      toast({ title: 'Could not save portal preferences', description: e.message, variant: 'destructive' });
    },
  });

  const handleLoadDefaults = () => {
    setRequirePasscode(true);
    setShowMeals(true);
    setAllowSongs(true);
    setEnableRegistry(true);
    setRegistryUrl('https://withjoy.com/smith-wedding');
    setExpiryDays(60);
    setLodgingRooms(8);
    setPortalWelcome('Welcome to our digital layout assistant.');
    setRemovePlatformBranding(false);
    setCustomCopyrightString('');
    setMapDirectionsLink('');
    setSupportEmailOverride('');
    toast({ title: 'Guest Portal factory defaults loaded', description: 'Click Save Portal Preferences below to persist.', variant: 'success' });
  };

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  return (
    <div className="space-y-6">
      {/* Quick Add Presets Panel */}
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
            <Sparkles className="h-4 w-4 text-brand animate-pulse" /> Load Portal Presets
          </h4>
          <p className="text-[10px] text-fg-subtle">Instantly load typical guest portal configuration templates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={() => {
             setRequirePasscode(true); setShowMeals(true); setAllowSongs(true); setEnableRegistry(true);
             setPortalWelcome("Welcome to our digital layout assistant.");
             toast({ title: 'Standard RSVP configuration loaded' });
          }}>🎉 Standard RSVP</Button>
          <Button size="xs" variant="outline" onClick={() => {
             setRequirePasscode(false); setShowMeals(false); setAllowSongs(false); setEnableRegistry(false);
             setPortalWelcome("Explore our digital layouts and accommodations.");
             toast({ title: 'Light Informative layout loaded' });
          }}>📖 Light Informative</Button>
          <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Portal Defaults</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-surface-2/40 p-4 rounded-xl border border-border space-y-4">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-brand" /> Portal Configurations
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="gate" className="text-xs font-semibold cursor-pointer">RSVP Password Gate</Label>
                  <p className="text-[10px] text-fg-subtle">Require sign-in passcode for RSVPs</p>
                </div>
                <input
                  type="checkbox"
                  id="gate"
                  checked={requirePasscode}
                  onChange={(e) => setRequirePasscode(e.target.checked)}
                  className="rounded border-border accent-brand h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="meals" className="text-xs font-semibold cursor-pointer">Menu & Dining Options</Label>
                  <p className="text-[10px] text-fg-subtle">Show dinner menus during portal RSVP</p>
                </div>
                <input
                  type="checkbox"
                  id="meals"
                  checked={showMeals}
                  onChange={(e) => setShowMeals(e.target.checked)}
                  className="rounded border-border accent-brand h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="songs" className="text-xs font-semibold cursor-pointer">Wedding Song Requests</Label>
                  <p className="text-[10px] text-fg-subtle">Allow guests to add to song list requests</p>
                </div>
                <input
                  type="checkbox"
                  id="songs"
                  checked={allowSongs}
                  onChange={(e) => setAllowSongs(e.target.checked)}
                  className="rounded border-border accent-brand h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="registry" className="text-xs font-semibold cursor-pointer">Registry Integration</Label>
                  <p className="text-[10px] text-fg-subtle">Enable external gift registry link</p>
                </div>
                <input
                  type="checkbox"
                  id="registry"
                  checked={enableRegistry}
                  onChange={(e) => setEnableRegistry(e.target.checked)}
                  className="rounded border-border accent-brand h-4 w-4"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="reg-url" className="text-[11px]">Registry URL</Label>
            <Input id="reg-url" disabled={!enableRegistry} value={registryUrl} onChange={(e) => setRegistryUrl(e.target.value)} className="h-9 text-xs mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiry" className="text-[11px]">Expiration Limit (days)</Label>
              <Input id="expiry" type="number" value={expiryDays} onChange={(e) => setExpiryDays(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
            </div>
            <div>
              <Label htmlFor="lodging" className="text-[11px]">Lodging Setup (Rooms/Cabins)</Label>
              <Input id="lodging" type="number" value={lodgingRooms} onChange={(e) => setLodgingRooms(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
            </div>
          </div>

          <div>
            <Label htmlFor="portal-msg" className="text-[11px]">Portal Welcome Message</Label>
            <Input id="portal-msg" value={portalWelcome} onChange={(e) => setPortalWelcome(e.target.value)} className="h-10 text-xs mt-1" />
          </div>

          {/* White-Label Configurations Card (Phase 4) */}
          <div className="bg-white p-4 rounded-xl border border-[#e1d5c9] space-y-4 font-semibold text-xs">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif text-brand">
              🛡️ Client White-Label Parameters
            </h4>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="remove-branding" className="text-xs font-semibold cursor-pointer">Remove Platform Branding</Label>
                  <p className="text-[10px] text-fg-subtle">Completely hides default platform footer logo</p>
                </div>
                <input
                  type="checkbox"
                  id="remove-branding"
                  checked={removePlatformBranding}
                  onChange={(e) => setRemovePlatformBranding(e.target.checked)}
                  className="rounded border-[#e1d5c9] text-brand accent-brand h-4 w-4 cursor-pointer"
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-border/40">
                 <div>
                    <Label htmlFor="custom-copyright" className="text-[10px] text-fg-subtle">Custom Copyright String</Label>
                    <Input id="custom-copyright" placeholder="e.g. © 2026 Seven Paths Manor. All rights reserved." value={customCopyrightString} onChange={e => setCustomCopyrightString(e.target.value)} className="h-9 mt-1 text-xs bg-surface border-[#e1d5c9]" />
                 </div>
                 <div>
                    <Label htmlFor="map-directions" className="text-[10px] text-fg-subtle">Custom Map Directions Link</Label>
                    <Input id="map-directions" placeholder="e.g. https://maps.google.com/?q=Seven+Paths+Manor" value={mapDirectionsLink} onChange={e => setMapDirectionsLink(e.target.value)} className="h-9 mt-1 text-xs bg-surface border-[#e1d5c9]" />
                 </div>
                 <div>
                    <Label htmlFor="support-email" className="text-[10px] text-fg-subtle">Support Email Override</Label>
                    <Input id="support-email" type="email" placeholder="coordinator@sevenpathsmanor.com" value={supportEmailOverride} onChange={e => setSupportEmailOverride(e.target.value)} className="h-9 mt-1 text-xs bg-surface border-[#e1d5c9]" />
                 </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label className="text-xs font-bold uppercase tracking-wider text-fg-subtle">Visual Guest Portal Simulation</Label>
          <div className="rounded-2xl border border-border bg-[#FDFBF7] shadow-md p-6 min-h-[400px] flex flex-col justify-between font-serif">
            <div className="space-y-4">
              <div className="border-b border-border/40 pb-3 flex justify-between items-center text-xs text-fg-subtle">
                <span>🔒 RSVP Security Enabled</span>
                <span className="bg-success-soft text-success px-2 py-0.5 rounded font-semibold">Active</span>
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-xl font-bold text-fg">Olivia & Thomas</h3>
                <p className="text-xs text-fg-muted">September 12, 2026</p>
              </div>

              <p className="text-xs text-center leading-relaxed text-fg-muted px-4 font-sans">
                {portalWelcome} Please respond by August 1st.
              </p>

              <div className="space-y-2 font-sans pt-2">
                {requirePasscode && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-brand" /> Passcode Sign-In Gate</span>
                    <span className="font-semibold text-fg">Required</span>
                  </div>
                )}
                {showMeals && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5"><Utensils className="h-3.5 w-3.5 text-brand" /> Dinner Menu Selection</span>
                    <span className="font-semibold text-fg">Enabled</span>
                  </div>
                )}
                {allowSongs && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5"><Music className="h-3.5 w-3.5 text-brand" /> Wedding Playlist Suggestion</span>
                    <span className="font-semibold text-fg">Enabled</span>
                  </div>
                )}
                {enableRegistry && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5 text-brand" /> Registry link</span>
                    <span className="font-semibold text-fg truncate max-w-[120px]">{registryUrl.replace('https://', '')}</span>
                  </div>
                )}
                {mapDirectionsLink && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5">🗺️ Map &amp; Directions</span>
                    <span className="font-semibold text-brand truncate max-w-[120px] underline cursor-pointer">View Google Map</span>
                  </div>
                )}
                {supportEmailOverride && (
                  <div className="p-3 bg-surface-2/40 border rounded-lg flex items-center justify-between text-xs text-fg-subtle">
                    <span className="flex items-center gap-1.5">📧 Coordinator Email</span>
                    <span className="font-semibold text-fg truncate max-w-[120px]">{supportEmailOverride}</span>
                  </div>
                )}
              </div>

              {/* Copyright & Branding Footer Simulator */}
              <div className="pt-4 mt-4 border-t border-border/40 text-[9px] text-fg-subtle flex flex-col items-center gap-1 text-center font-sans">
                 <div>{customCopyrightString || '© 2026 Olivia & Thomas. All rights reserved.'}</div>
                 {!removePlatformBranding && (
                    <div className="text-[8px] uppercase tracking-wider text-brand font-bold mt-1 flex items-center gap-1">
                       💒 Powered by Wedding Venue Intelligence
                    </div>
                 )}
              </div>
            </div>

            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full mt-4 font-sans">
              {saveMutation.isPending ? 'Saving...' : 'Save Portal Preferences'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
