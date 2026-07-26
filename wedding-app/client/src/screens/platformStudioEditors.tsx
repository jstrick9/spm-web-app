import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';

export function ConfigSectionEditor({ title, description, value, busy, onSave }: { title: string; description: string; value: unknown; busy: boolean; onSave: (value: any) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState('');
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-3"><Label htmlFor={`studio-${title}`}>Configuration JSON</Label><textarea id={`studio-${title}`} className="min-h-72 w-full rounded-md border border-border bg-surface p-3 font-mono text-xs" value={text} onChange={(e) => { setText(e.target.value); setError(''); }} />{error && <p className="text-sm text-danger">{error}</p>}<Button isLoading={busy} onClick={() => { try { onSave(JSON.parse(text)); } catch { setError('Enter valid JSON before saving.'); } }}>Save {title}</Button></CardContent></Card>;
}

export function BrandingEditor({ value, busy, onSave }: { value: any; busy: boolean; onSave: (value: any) => void }) {
  const [branding, setBranding] = useState(value);
  const update = (key: string, value: string) => setBranding((current: any) => ({ ...current, [key]: value }));
  return <Card><CardHeader><CardTitle>Organization branding</CardTitle><CardDescription>Set the name, tagline, support contact, logo, and typography used across the platform.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="brand-name">Platform name</Label><Input id="brand-name" value={branding.platformName ?? ''} onChange={(e) => update('platformName', e.target.value)} /></div><div><Label htmlFor="brand-tagline">Tagline</Label><Input id="brand-tagline" value={branding.tagline ?? ''} onChange={(e) => update('tagline', e.target.value)} /></div><div><Label htmlFor="brand-support">Support email</Label><Input id="brand-support" type="email" value={branding.supportEmail ?? ''} onChange={(e) => update('supportEmail', e.target.value)} /></div><div><Label htmlFor="brand-logo">Logo URL</Label><Input id="brand-logo" type="url" value={branding.logoUrl ?? ''} onChange={(e) => update('logoUrl', e.target.value)} /></div><div><Label htmlFor="brand-heading">Heading font</Label><Input id="brand-heading" value={branding.headingFont ?? ''} onChange={(e) => update('headingFont', e.target.value)} /></div><div><Label htmlFor="brand-body">Body font</Label><Input id="brand-body" value={branding.bodyFont ?? ''} onChange={(e) => update('bodyFont', e.target.value)} /></div><div className="md:col-span-2"><Button isLoading={busy} onClick={() => onSave(branding)}>Save branding</Button></div></CardContent></Card>;
}
