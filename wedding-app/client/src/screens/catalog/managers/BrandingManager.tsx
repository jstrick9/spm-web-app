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
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { useToast } from '../../../ui/Toast';

export function BrandingManager({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [orgName, setOrgName] = useState('Seven Paths Manor');
  const [supportEmail, setSupportEmail] = useState('hello@sevenpathsmanor.com');
  const [phone, setPhone] = useState('(555) 019-2831');
  const [webUrl, setWebUrl] = useState('https://sevenpathsmanor.com');
  const [location, setLocation] = useState('Anytown, USA');
  
  // Custom theme colors
  const [brandColor, setBrandColor] = useState('#800020');
  const [bgColor, setBgColor] = useState('#FDFBF7');
  const [headerTextColor, setHeaderTextColor] = useState('#FFFFFF');
  const [bodyTextColor, setBodyTextColor] = useState('#2C2A29');
  const [accentTextColor, setAccentTextColor] = useState('#800020');

  // Custom welcome screens
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome to our digital layout assistant.');
  const [welcomeSubMessage, setWelcomeSubMessage] = useState('Feel free to configure the floorplan specs.');
  const [welcomeLogoPhoto, setWelcomeLogoPhoto] = useState<string | null>(null);

  const [headingFont, setHeadingFont] = useState('Fraunces');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [logoPhoto, setLogoPhoto] = useState<string | null>(null);
  
  // Accordion Sections state
  const [activeSection, setActiveSection] = useState<string | null>('identity');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const welcomeInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleWelcomeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setWelcomeLogoPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all branding settings to factory defaults?')) {
      setOrgName('Seven Paths Manor');
      setSupportEmail('hello@sevenpathsmanor.com');
      setPhone('(555) 019-2831');
      setWebUrl('https://sevenpathsmanor.com');
      setLocation('Anytown, USA');
      setBrandColor('#800020');
      setBgColor('#FDFBF7');
      setHeaderTextColor('#FFFFFF');
      setBodyTextColor('#2C2A29');
      setAccentTextColor('#800020');
      setWelcomeMessage('Welcome to our digital layout assistant.');
      setWelcomeSubMessage('Feel free to configure the floorplan specs.');
      setWelcomeLogoPhoto(null);
      setHeadingFont('Fraunces');
      setBodyFont('Inter');
      setLogoPhoto(null);
      toast({ title: 'Branding settings reset to factory defaults', variant: 'success' });
    }
  };

  const saveBrandingMutation = useMutation({
    mutationFn: () =>
      sdk.orgs.updateBranding(orgId, {
        name: orgName,
        support_email: supportEmail,
        phone,
        website_url: webUrl,
        brandColor,
        headingFont,
        bodyFont,
        logo: logoPhoto,
        bgColor,
        headerTextColor,
        bodyTextColor,
        accentTextColor,
        welcomeMessage,
        welcomeSubMessage,
        welcomeLogoPhoto,
        location
      }),
    onSuccess: () => {
      toast({ title: 'Venue branding saved successfully', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to update branding details', variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Accordion Configurations Form */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Section 1: Logo & Identity */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === 'identity' ? null : 'identity')}
              className="w-full flex items-center justify-between p-4 bg-surface-2/40 border-b border-border text-xs font-bold text-fg uppercase tracking-wider text-left font-serif"
            >
              <span>🏷️ Logo &amp; Identity</span>
              {activeSection === 'identity' ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
            </button>
            {activeSection === 'identity' && (
              <div className="p-4 space-y-4">
                <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-fg">Venue Logo</Label>
                    <p className="text-[10px] text-fg-subtle">PNG, JPG, or SVG base64 image</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="file" accept="image/*" onChange={handleLogoUpload} ref={fileInputRef} className="hidden" />
                    <Button size="xs" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> {logoPhoto ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    {logoPhoto && (
                      <div className="flex items-center gap-2">
                        <img src={logoPhoto} alt="Venue Logo" className="h-10 w-10 object-contain rounded-md border border-border bg-white p-1" />
                        <Button size="xs" variant="ghost" className="text-danger animate-pulse" onClick={() => setLogoPhoto(null)}>
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="org-name" className="text-[10px]">Organization Name</Label>
                  <Input id="org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Website & Contacts */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === 'contact' ? null : 'contact')}
              className="w-full flex items-center justify-between p-4 bg-surface-2/40 border-b border-border text-xs font-bold text-fg uppercase tracking-wider text-left font-serif"
            >
              <span>🌐 Website &amp; Contact</span>
              {activeSection === 'contact' ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
            </button>
            {activeSection === 'contact' && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="org-email" className="text-[10px]">Support Email</Label>
                    <Input id="org-email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="h-9 text-xs mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="org-phone" className="text-[10px]">Telephone</Label>
                    <Input id="org-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 text-xs mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="org-web" className="text-[10px]">Website URL</Label>
                    <Input id="org-web" value={webUrl} onChange={(e) => setWebUrl(e.target.value)} className="h-9 text-xs mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="org-loc" className="text-[10px]">Venue Location</Label>
                    <Input id="org-loc" value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 text-xs mt-1" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Welcome Screen Customizer */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === 'welcome' ? null : 'welcome')}
              className="w-full flex items-center justify-between p-4 bg-surface-2/40 border-b border-border text-xs font-bold text-fg uppercase tracking-wider text-left font-serif"
            >
              <span>👋 Welcome Screen Settings</span>
              {activeSection === 'welcome' ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
            </button>
            {activeSection === 'welcome' && (
              <div className="p-4 space-y-4">
                <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-fg">Welcome Cover Photo</Label>
                    <p className="text-[10px] text-fg-subtle">PNG, JPG, or SVG base64 image</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="file" accept="image/*" onChange={handleWelcomeUpload} ref={welcomeInputRef} className="hidden" />
                    <Button size="xs" variant="outline" onClick={() => welcomeInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5 mr-1" /> {welcomeLogoPhoto ? 'Change Cover' : 'Upload Cover'}
                    </Button>
                    {welcomeLogoPhoto && (
                      <div className="flex items-center gap-2">
                        <img src={welcomeLogoPhoto} alt="Welcome Cover" className="h-10 w-10 object-cover rounded-md border border-border shadow-sm" />
                        <Button size="xs" variant="ghost" className="text-danger" onClick={() => setWelcomeLogoPhoto(null)}>
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="welcome-msg" className="text-[10px]">Welcome Message Header</Label>
                  <Input id="welcome-msg" value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
                <div>
                  <Label htmlFor="welcome-sub" className="text-[10px]">Welcome Sub-Message</Label>
                  <Input id="welcome-sub" value={welcomeSubMessage} onChange={(e) => setWelcomeSubMessage(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Color Scheme Palette */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === 'colors' ? null : 'colors')}
              className="w-full flex items-center justify-between p-4 bg-surface-2/40 border-b border-border text-xs font-bold text-fg uppercase tracking-wider text-left font-serif"
            >
              <span>🎨 Color Theme &amp; Palettes</span>
              {activeSection === 'colors' ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
            </button>
            {activeSection === 'colors' && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs font-semibold">
                  <div>
                    <Label className="text-[10px]">Brand Accent</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-12 border rounded cursor-pointer" />
                      <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 text-[10px] uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Background</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 border rounded cursor-pointer" />
                      <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 text-[10px] uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Header Text</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={headerTextColor} onChange={(e) => setHeaderTextColor(e.target.value)} className="h-9 w-12 border rounded cursor-pointer" />
                      <Input value={headerTextColor} onChange={(e) => setHeaderTextColor(e.target.value)} className="h-9 text-[10px] uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Body Text</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={bodyTextColor} onChange={(e) => setBodyTextColor(e.target.value)} className="h-9 w-12 border rounded cursor-pointer" />
                      <Input value={bodyTextColor} onChange={(e) => setBodyTextColor(e.target.value)} className="h-9 text-[10px] uppercase font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Accent Text</Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input type="color" value={accentTextColor} onChange={(e) => setAccentTextColor(e.target.value)} className="h-9 w-12 border rounded cursor-pointer" />
                      <Input value={accentTextColor} onChange={(e) => setAccentTextColor(e.target.value)} className="h-9 text-[10px] uppercase font-mono" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Typography Advanced Selection */}
          <div className="rounded-xl border border-[#e1d5c9] bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setActiveSection(activeSection === 'typography' ? null : 'typography')}
              className="w-full flex items-center justify-between p-4 bg-surface-2/40 border-b border-border text-xs font-bold text-fg uppercase tracking-wider text-left font-serif"
            >
              <span>✍️ Advanced Typography &amp; Fonts</span>
              {activeSection === 'typography' ? <ChevronUp className="h-4 w-4 text-brand" /> : <ChevronDown className="h-4 w-4 text-brand" />}
            </button>
            {activeSection === 'typography' && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                  <div>
                    <Label htmlFor="heading-font-sel">Heading Google Font</Label>
                    <select
                      id="heading-font-sel"
                      value={headingFont}
                      onChange={(e) => setHeadingFont(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1.5"
                    >
                      <option value="Fraunces">Fraunces (Editorial)</option>
                      <option value="Playfair Display">Playfair Display (Serif)</option>
                      <option value="Montserrat">Montserrat (Geometric)</option>
                      <option value="Cinzel">Cinzel (Classic)</option>
                      <option value="Poppins">Poppins (Clean)</option>
                      <option value="Noto Serif">Noto Serif (Classic)</option>
                      <option value="Georgia">Georgia (Traditional)</option>
                      <option value="Quicksand">Quicksand (Whimsical)</option>
                    </select>
                    <p className="text-[10px] text-fg-subtle mt-1" style={{ fontFamily: headingFont }}>Preview String: Seven Paths Manor</p>
                  </div>

                  <div>
                    <Label htmlFor="body-font-sel">Body Google Font</Label>
                    <select
                      id="body-font-sel"
                      value={bodyFont}
                      onChange={(e) => setBodyFont(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1.5"
                    >
                      <option value="Inter">Inter (Sans-Serif)</option>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Noto Serif">Noto Serif</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Quicksand">Quicksand (Whimsical)</option>
                      <option value="Poppins">Poppins</option>
                    </select>
                    <p className="text-[10px] text-fg-subtle mt-1" style={{ fontFamily: bodyFont }}>Preview String: The quick brown fox jumps.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
             <Button onClick={() => saveBrandingMutation.mutate()} className="flex-1 h-11 tracking-wider font-semibold text-xs">
               <Save className="h-4 w-4 mr-2" /> Save Branding Preferences
             </Button>
             <Button variant="outline" onClick={handleReset} className="h-11 font-semibold text-xs border-danger/20 text-danger hover:bg-danger/10">
               Reset Factory Defaults
             </Button>
          </div>
        </div>

        {/* 👁️ Right Panel: Fully Interactive Real-Time Live Brand Simulator */}
        <div className="lg:col-span-2 space-y-4">
          <Label className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1.5 font-serif">
             <Eye className="h-4 w-4 text-brand animate-pulse" /> Live Brand Simulator
          </Label>
          <div className="rounded-2xl border border-[#e1d5c9] bg-white shadow-md overflow-hidden min-h-[500px] flex flex-col justify-between" style={{ backgroundColor: bgColor }}>
            
            {/* Header Simulator */}
            <div className="p-4 text-white flex items-center gap-3" style={{ backgroundColor: brandColor, color: headerTextColor }}>
              {logoPhoto ? (
                <img src={logoPhoto} alt="Logo" className="h-8 w-8 object-contain rounded bg-white p-0.5" />
              ) : (
                <span className="text-2xl">💒</span>
              )}
              <div>
                <h4 className="font-bold text-xs" style={{ fontFamily: headingFont }}>{orgName}</h4>
                <p className="text-[9px] opacity-90" style={{ fontFamily: bodyFont }}>Where every detail is intentional.</p>
              </div>
            </div>

            {/* Welcome Cover Photo Simulator */}
            {welcomeLogoPhoto ? (
              <div className="h-44 w-full relative overflow-hidden">
                <img src={welcomeLogoPhoto} alt="Welcome Cover" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                   <span className="text-white text-xs font-serif italic tracking-wide">Premium Venue Layouts</span>
                </div>
              </div>
            ) : (
              <div className="h-32 bg-surface-2 border-b border-border flex items-center justify-center text-xs text-fg-subtle italic">
                 No welcome cover cover uploaded. Add one in the Settings panel!
              </div>
            )}

            {/* Content Simulator */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-fg leading-snug" style={{ fontFamily: headingFont, color: accentTextColor }}>
                  {welcomeMessage}
                </h3>
                <p className="text-xs leading-relaxed" style={{ fontFamily: bodyFont, color: bodyTextColor }}>
                  {welcomeSubMessage} Leverage our interactive snapping stages, layouts boundaries, and lodging maps.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-[9px] text-fg-subtle font-sans">
                  <span className="bg-surface px-2.5 py-1 rounded border border-border shadow-xs">📞 {phone}</span>
                  <span className="bg-surface px-2.5 py-1 rounded border border-border shadow-xs">📍 {location}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-border/40 space-y-2">
                <div className="flex gap-2">
                  <button className="flex-1 py-2 text-[10px] font-bold text-white rounded-lg transition-transform hover:scale-[1.02]" style={{ backgroundColor: brandColor, color: headerTextColor }}>
                    Explore Layouts
                  </button>
                  <button className="flex-1 py-2 text-[10px] font-bold border border-border rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors" style={{ color: bodyTextColor }}>
                    Contact Office
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
