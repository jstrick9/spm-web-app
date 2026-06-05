import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Globe, Lock, Key, Link as LinkIcon, Save, ExternalLink, Heart, Sparkles, MessageSquare, CheckSquare, Palette } from 'lucide-react';
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
  
  // Custom RSVP Page Customization States (Phase 6 + Part 3 Extensions)
  const [welcomeTitle, setWelcomeTitle] = useState('We Are Getting Married!');
  const [tagline, setTagline] = useState('Please join us on our special day.');
  const [customBrandColor, setCustomBrandColor] = useState('#6B21A8');
  const [enableSongRequests, setEnableSongRequests] = useState(false);
  const [enableDietaryDetails, setEnableDietaryDetails] = useState(false);
  const [enableLodgingChoices, setEnableLodgingChoices] = useState(false);
  
  // Brand New A/B Theme & SMS Reminders (Part 3)
  const [rsvpTheme, setRsvpTheme] = useState('classic_vintage');
  const [enableSmsReminders, setEnableSmsReminders] = useState(false);
  const [smsTemplate, setSmsTemplate] = useState('Hi {{guest_name}}, this is a quick reminder that RSVPs for our wedding are due on {{rsvp_deadline}}! Please submit yours at: {{portal_link}}');

  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['portalConfig', eventId],
    queryFn: () => sdk.guests.getPortalConfig(eventId),
  });

  // Initialize state once loaded
  useEffect(() => {
    if (data && data.config) {
      setLocalEnabled(data.config.enabled === 1);
      setHasPassword(!!data.config.password_hash);
      
      const parsedConfig = typeof data.config.config === 'string' 
        ? JSON.parse(data.config.config || '{}') 
        : (data.config.config || {});
        
      setWelcomeTitle(parsedConfig.welcomeTitle || 'We Are Getting Married!');
      setTagline(parsedConfig.tagline || 'Please join us on our special day.');
      setCustomBrandColor(parsedConfig.brandColor || '#6B21A8');
      setEnableSongRequests(!!parsedConfig.enableSongRequests);
      setEnableDietaryDetails(!!parsedConfig.enableDietaryDetails);
      setEnableLodgingChoices(!!parsedConfig.enableLodgingChoices);
      
      setRsvpTheme(parsedConfig.rsvpTheme || 'classic_vintage');
      setEnableSmsReminders(!!parsedConfig.enableSmsReminders);
      setSmsTemplate(parsedConfig.smsTemplate || 'Hi {{guest_name}}, this is a quick reminder that RSVPs for our wedding are due on {{rsvp_deadline}}! Please submit yours at: {{portal_link}}');

      setIsDirty(false);
      setNewPassword('');
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => {
       const payload: any = { 
         enabled: localEnabled,
         config: {
           welcomeTitle,
           tagline,
           brandColor: customBrandColor,
           enableSongRequests,
           enableDietaryDetails,
           enableLodgingChoices,
           rsvpTheme,
           enableSmsReminders,
           smsTemplate,
         }
       };
       if (newPassword) payload.password = newPassword;
       else if (!hasPassword) payload.clearPassword = true;
       return sdk.guests.updatePortalConfig(eventId, payload);
    },
    onSuccess: () => {
       qc.invalidateQueries({ queryKey: ['portalConfig', eventId] });
       toast({ title: 'Portal settings saved successfully', variant: 'success' });
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
    <div className="space-y-6 max-w-6xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
         
         {/* Left Column: Config Panel */}
         <div className="space-y-6">
            <Card className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between pb-4 border-b border-[#e1d5c9]">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2 font-serif font-black text-brand">
                    <Globe className="w-5 h-5 text-brand" /> Public Guest Portal
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    Configure the public-facing RSVP and logistics portal for invited guests.
                  </CardDescription>
                </div>
                
                <button 
                   type="button"
                   onClick={handleToggleEnable}
                   className={cn(
                     "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                     localEnabled ? "bg-emerald-600" : "bg-gray-200"
                   )}
                >
                   <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      localEnabled ? "translate-x-6" : "translate-x-1"
                   )} />
                </button>
              </CardHeader>
              
              <CardContent className="space-y-6 pt-6 bg-white">
                 <div className="bg-[#FDFBF7] rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border border-[#e1d5c9]">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2 mb-1 text-xs font-bold text-fg-muted uppercase tracking-wider">
                         <LinkIcon className="w-4 h-4 text-brand" /> Shareable Link
                      </Label>
                      <div className="text-xs font-mono text-fg-subtle select-all bg-white px-3 py-1.5 rounded border border-[#e1d5c9]">
                         {portalUrl}
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <Button 
                         variant="outline" 
                         className="text-xs font-bold border-[#e1d5c9]"
                         onClick={() => {
                           navigator.clipboard.writeText(portalUrl);
                           toast({ title: 'Link copied to clipboard', variant: 'success' });
                         }}
                       >
                         Copy URL
                       </Button>
                       <a href={portalUrl} target="_blank" rel="noreferrer">
                         <Button variant="secondary" className="text-xs font-bold bg-[#2C2A29] hover:bg-[#3d3b3a] text-white"><ExternalLink className="w-4 h-4 mr-1" /> Visit</Button>
                       </a>
                    </div>
                 </div>
              </CardContent>
            </Card>

            <Card className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-[#e1d5c9]">
                 <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                   <Lock className="w-4 h-4 text-brand" /> Access &amp; Security
                 </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6 bg-white">
                 
                 <div className="flex items-start gap-3">
                    <input 
                       type="checkbox" 
                       id="pwd-gate"
                       checked={hasPassword}
                       onChange={handleTogglePassword}
                       className="mt-1"
                    />
                    <div className="flex-1">
                       <Label htmlFor="pwd-gate" className="font-bold cursor-pointer text-sm">Require a master password</Label>
                       <p className="text-xs text-fg-subtle mt-1 mb-3 font-semibold leading-relaxed">Guests will need to enter this shared password to view the event details and access the RSVP form.</p>
                       
                       {hasPassword && (
                         <div className="max-w-xs space-y-2">
                            <Label className="text-xs">Set Password</Label>
                            <Input 
                               type="text" 
                               placeholder="e.g. Smith2026" 
                               value={newPassword}
                               onChange={(e) => {
                                  setNewPassword(e.target.value);
                                  setIsDirty(true);
                               }}
                               className="bg-[#FDFBF7]"
                            />
                            {data?.config?.password_hash && !newPassword && (
                              <p className="text-xs text-emerald-600 font-bold">A password is currently set. Type a new one to replace it.</p>
                            )}
                         </div>
                       )}
                    </div>
                 </div>
                 
              </CardContent>
            </Card>

            {/* Invitation & RSVP Page Designer */}
            <Card className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
               <CardHeader className="pb-3 border-b border-[#e1d5c9]">
                  <CardTitle className="text-base flex items-center gap-2 text-brand font-black font-serif">
                     🎨 Invitation &amp; RSVP Page Designer
                  </CardTitle>
                  <CardDescription className="text-xs text-fg-subtle">
                     White-label your guest-facing wedding landing page, toggle custom layouts and custom form fields.
                  </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4 pt-6 bg-white">
                  
                  {/* A/B Theme Choice Selector */}
                  <div className="space-y-1.5">
                     <Label className="text-xs font-bold text-fg-muted uppercase tracking-wider block">A/B Page Layout Theme</Label>
                     <select
                        className="w-full text-xs p-2.5 rounded-lg border border-[#e1d5c9] bg-white font-semibold"
                        value={rsvpTheme}
                        onChange={(e) => { setRsvpTheme(e.target.value); setIsDirty(true); }}
                     >
                        <option value="classic_vintage">📜 Classic Vintage (Serif &amp; Floral Frames)</option>
                        <option value="modern_minimalist">📐 Modern Minimalist (Monochrome Sans-Serif)</option>
                        <option value="bohemian_chic">🌾 Bohemian Chic (Terracotta scripts)</option>
                     </select>
                  </div>

                  <div>
                     <Label className="text-xs font-bold text-fg-muted uppercase tracking-wider">Wedding Welcome Title</Label>
                     <Input 
                        value={welcomeTitle} 
                        onChange={(e) => { setWelcomeTitle(e.target.value); setIsDirty(true); }}
                        className="mt-1 bg-[#FDFBF7] border-[#e1d5c9] text-xs h-9 font-semibold" 
                     />
                  </div>

                  <div>
                     <Label className="text-xs font-bold text-fg-muted uppercase tracking-wider">Welcoming Tagline / Description</Label>
                     <Input 
                        value={tagline} 
                        onChange={(e) => { setTagline(e.target.value); setIsDirty(true); }}
                        className="mt-1 bg-[#FDFBF7] border-[#e1d5c9] text-xs h-9 font-semibold" 
                     />
                  </div>

                  <div>
                     <Label className="text-xs font-bold text-fg-muted uppercase tracking-wider">Wedding Highlight Brand Color</Label>
                     <div className="flex items-center gap-2 mt-1">
                        <input 
                           type="color" 
                           value={customBrandColor} 
                           onChange={(e) => { setCustomBrandColor(e.target.value); setIsDirty(true); }}
                           className="h-9 w-9 rounded-md border border-[#e1d5c9] cursor-pointer bg-white"
                        />
                        <Input 
                           value={customBrandColor} 
                           onChange={(e) => { setCustomBrandColor(e.target.value); setIsDirty(true); }}
                           className="bg-[#FDFBF7] border-[#e1d5c9] text-xs h-9 w-28 uppercase font-semibold" 
                        />
                     </div>
                  </div>

                  <div className="pt-3 border-t space-y-3 font-semibold text-xs text-fg">
                     <h4 className="text-[10px] text-fg-subtle uppercase tracking-wider font-bold">Interactive RSVP Form Custom fields</h4>
                     
                     <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-surface-2 transition-colors bg-[#FDFBF7] border rounded-xl p-3 border-[#e1d5c9]/60">
                        <input 
                           type="checkbox" 
                           checked={enableSongRequests} 
                           onChange={(e) => { setEnableSongRequests(e.target.checked); setIsDirty(true); }}
                           className="rounded border-[#e1d5c9] text-brand accent-brand h-4 w-4 cursor-pointer"
                        />
                        <div>
                           <div>Collect Song &amp; Music Requests</div>
                           <div className="text-[10px] text-fg-subtle font-normal">Let guests specify songs they want played.</div>
                        </div>
                     </label>

                     <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-surface-2 transition-colors bg-[#FDFBF7] border rounded-xl p-3 border-[#e1d5c9]/60">
                        <input 
                           type="checkbox" 
                           checked={enableDietaryDetails} 
                           onChange={(e) => { setEnableDietaryDetails(e.target.checked); setIsDirty(true); }}
                           className="rounded border-[#e1d5c9] text-brand accent-brand h-4 w-4 cursor-pointer"
                        />
                        <div>
                           <div>Collect Detailed Dietary Restrictions</div>
                           <div className="text-[10px] text-fg-subtle font-normal">Let guests write custom allergy or menu notes.</div>
                        </div>
                     </label>

                     <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-surface-2 transition-colors bg-[#FDFBF7] border rounded-xl p-3 border-[#e1d5c9]/60">
                        <input 
                           type="checkbox" 
                           checked={enableLodgingChoices} 
                           onChange={(e) => { setEnableLodgingChoices(e.target.checked); setIsDirty(true); }}
                           className="rounded border-[#e1d5c9] text-brand accent-brand h-4 w-4 cursor-pointer"
                        />
                        <div>
                           <div>Collect Overnight Lodging Requests</div>
                           <div className="text-[10px] text-fg-subtle font-normal">Ask guests if they desire onsite cabin accommodation.</div>
                        </div>
                     </label>
                  </div>
               </CardContent>
            </Card>

            {/* Automated SMS Reminders Panel */}
            <Card className="bg-[#FDFBF7] border border-[#e1d5c9] shadow-sm rounded-2xl overflow-hidden">
               <CardHeader className="pb-3 border-b border-[#e1d5c9]">
                  <div className="flex justify-between items-center">
                     <CardTitle className="text-base flex items-center gap-2 text-brand font-black font-serif">
                        <MessageSquare className="w-4 h-4 text-brand" /> Automated Low-Velocity SMS Reminders
                     </CardTitle>
                     <button 
                        type="button"
                        aria-label="Automated Low-Velocity SMS Reminders"
                        onClick={() => { setEnableSmsReminders(!enableSmsReminders); setIsDirty(true); }}
                        className={cn(
                          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                          enableSmsReminders ? "bg-emerald-600" : "bg-gray-200"
                        )}
                     >
                        <span className={cn(
                           "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                           enableSmsReminders ? "translate-x-4" : "translate-x-1"
                        )} />
                     </button>
                  </div>
                  <CardDescription className="text-xs text-fg-subtle">
                     Automatically dispatch text reminders to guests whose RSVPs are pending within 7 days of the deadline.
                  </CardDescription>
               </CardHeader>
               <CardContent className="pt-6 space-y-4 bg-white">
                  {enableSmsReminders && (
                     <div className="space-y-3.5 animate-in slide-in-from-top-2 duration-200">
                        <div className="space-y-1">
                           <Label htmlFor="smsTemplateInput" className="text-xs font-bold text-fg-subtle uppercase block mb-1">SMS Message Template</Label>
                           <textarea
                              id="smsTemplateInput"
                              rows={3}
                              className="w-full text-xs p-2.5 rounded-lg border border-[#e1d5c9] bg-[#FDFBF7] font-semibold text-fg-muted focus-visible:outline-none"
                              value={smsTemplate}
                              onChange={(e) => { setSmsTemplate(e.target.value); setIsDirty(true); }}
                           />
                           <span className="text-[10px] text-fg-subtle font-semibold block leading-tight">
                              Supported variables: <strong className="text-fg font-black">{"{{guest_name}}"}</strong>, <strong className="text-fg font-black">{"{{rsvp_deadline}}"}</strong>, <strong className="text-fg font-black">{"{{portal_link}}"}</strong>.
                           </span>
                        </div>
                     </div>
                  )}
               </CardContent>
            </Card>
         </div>

         {/* Right Column: Live Mobile Mockup Preview */}
         <div className="lg:col-span-1 sticky top-4 flex flex-col items-center">
            <Card className="border-[#e1d5c9] bg-[#FDFBF7] shadow-lg overflow-hidden flex flex-col items-center p-6 min-h-[500px] w-full rounded-2xl">
               <h3 className="font-serif font-black text-xs uppercase tracking-wider text-brand mb-4 flex items-center gap-1.5 self-start">
                  📱 Live Mobile RSVP Preview
               </h3>
               
               {/* Phone container mockup */}
               <div className="w-[300px] h-[550px] bg-zinc-950 rounded-[40px] border-[10px] border-zinc-900 shadow-2xl relative overflow-hidden flex flex-col p-1">
                  
                  {/* Phone Speaker Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 h-4 w-28 bg-zinc-900 rounded-b-xl z-20"></div>

                  {/* Inside Screen Content */}
                  <div className={cn(
                     "flex-1 rounded-[30px] overflow-y-auto flex flex-col p-4 text-center relative scrollbar-none transition-all",
                     rsvpTheme === 'modern_minimalist' && "bg-white text-black font-sans border-0",
                     rsvpTheme === 'classic_vintage' && "bg-[#FDFBF7] text-[#2C2A29] font-serif border-4 border-double border-[#e1d5c9] p-3",
                     rsvpTheme === 'bohemian_chic' && "bg-orange-50/30 text-amber-950 font-serif border border-orange-200/50"
                  )}>
                     
                     {/* Cover Top Portion */}
                     <div className={cn(
                        "pt-6 pb-4 flex flex-col items-center",
                        rsvpTheme === 'modern_minimalist' && "border-b border-black/10",
                        rsvpTheme === 'classic_vintage' && "border-b border-[#e1d5c9]",
                        rsvpTheme === 'bohemian_chic' && "border-b border-orange-200"
                     )}>
                        <Heart className="h-8 w-8 mb-2 animate-bounce" style={{ color: customBrandColor }} />
                        <h1 className={cn(
                           "text-sm font-black tracking-tight",
                           rsvpTheme === 'modern_minimalist' && "font-sans uppercase tracking-widest",
                           rsvpTheme === 'classic_vintage' && "font-serif text-base italic",
                           rsvpTheme === 'bohemian_chic' && "font-serif font-bold text-orange-800"
                        )} style={{ color: customBrandColor }}>
                           {welcomeTitle}
                        </h1>
                        <p className="text-[10px] text-fg-subtle font-medium mt-1 leading-relaxed max-w-[200px] italic">
                           "{tagline}"
                        </p>
                     </div>

                     {/* RSVP Mock Form Section */}
                     <div className="py-4 text-left font-sans text-xs font-semibold text-fg space-y-3.5 flex-1">
                        <h4 className={cn(
                           "text-[10px] uppercase font-bold text-fg-subtle border-b pb-1",
                           rsvpTheme === 'modern_minimalist' && "border-black/15",
                           rsvpTheme === 'classic_vintage' && "border-[#e1d5c9]"
                        )}>Guest RSVP Form</h4>
                        
                        <div>
                           <label className="text-[10px] text-fg-subtle block">Select Your Name</label>
                           <div className="mt-1 h-8 w-full border rounded-lg bg-white px-2 flex items-center text-fg-subtle">
                              Select name...
                           </div>
                        </div>

                        <div className="flex gap-4">
                           <label className="flex items-center gap-1.5"><input type="radio" checked readOnly className="accent-brand" style={{ accentColor: customBrandColor }} /> Attending</label>
                           <label className="flex items-center gap-1.5 opacity-60"><input type="radio" checked={false} readOnly /> Declined</label>
                        </div>

                        {enableDietaryDetails && (
                           <div className="space-y-1 animate-in slide-in-from-top-2">
                              <label className="text-[10px] text-fg-subtle block">Dietary Restrictions</label>
                              <div className="h-8 w-full border rounded-lg bg-white px-2 flex items-center text-fg-muted italic text-[11px]">
                                 e.g. Gluten-Free, Vegan...
                              </div>
                           </div>
                        )}

                        {enableSongRequests && (
                           <div className="space-y-1 animate-in slide-in-from-top-2">
                              <label className="text-[10px] text-fg-subtle block">Song Request</label>
                              <div className="h-8 w-full border rounded-lg bg-white px-2 flex items-center text-fg-muted italic text-[11px]">
                                 e.g. Love On Top - Beyoncé...
                              </div>
                           </div>
                        )}

                        {enableLodgingChoices && (
                           <div className="space-y-1 animate-in slide-in-from-top-2">
                              <label className="text-[10px] text-fg-subtle block">On-Site Lodging Request</label>
                              <div className="flex gap-4 mt-1">
                                 <label className="flex items-center gap-1.5"><input type="radio" checked readOnly /> Yes</label>
                                 <label className="flex items-center gap-1.5"><input type="radio" checked={false} readOnly /> No</label>
                              </div>
                           </div>
                        )}
                        
                        <Button 
                           size="sm" 
                           disabled 
                           className="w-full h-9 font-bold text-xs uppercase rounded-xl tracking-wider shadow-md text-white mt-2"
                           style={{ backgroundColor: customBrandColor }}
                        >
                           Submit RSVP
                        </Button>
                     </div>

                  </div>
               </div>
            </Card>
         </div>

      </div>
      
      {isDirty && (
        <div className="flex items-center justify-between p-4 bg-surface-2 border border-border rounded-lg shadow-sm animate-in slide-in-from-bottom-4 sticky bottom-4">
           <div className="text-sm font-medium">Unsaved changes</div>
           <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                 setLocalEnabled(data?.config?.enabled === 1);
                 setHasPassword(!!data?.config?.password_hash);
                 
                 const parsedConfig = typeof data?.config?.config === 'string' 
                   ? JSON.parse(data?.config?.config || '{}') 
                   : (data?.config?.config || {});
                   
                 setWelcomeTitle(parsedConfig.welcomeTitle || 'We Are Getting Married!');
                 setTagline(parsedConfig.tagline || 'Please join us on our special day.');
                 setCustomBrandColor(parsedConfig.brandColor || '#6B21A8');
                 setEnableSongRequests(!!parsedConfig.enableSongRequests);
                 setEnableDietaryDetails(!!parsedConfig.enableDietaryDetails);
                 setEnableLodgingChoices(!!parsedConfig.enableLodgingChoices);
                 
                 setRsvpTheme(parsedConfig.rsvpTheme || 'classic_vintage');
                 setEnableSmsReminders(!!parsedConfig.enableSmsReminders);
                 setSmsTemplate(parsedConfig.smsTemplate || 'Hi {{guest_name}}, this is a quick reminder that RSVPs for our wedding are due on {{rsvp_deadline}}! Please submit yours at: {{portal_link}}');

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
