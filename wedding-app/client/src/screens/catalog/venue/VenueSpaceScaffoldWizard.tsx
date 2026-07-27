import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Compass, Plus, Ruler, ShieldCheck, TentTree } from 'lucide-react';
import { venuesSdk } from '../../../sdk/venues';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { useToast } from '../../../ui/Toast';

const TEMPLATES = [
  { key: 'ceremony', label: 'Ceremony', icon: Compass, environment: 'indoor', description: 'Aisle, focal point, processional entrance, guest seating, accessible route, and exits.' },
  { key: 'cocktail', label: 'Cocktail hour', icon: Plus, environment: 'indoor', description: 'Bar, cocktail tables, food stations, circulation, and service zones.' },
  { key: 'reception', label: 'Reception', icon: ShieldCheck, environment: 'indoor', description: 'Tables, dance floor, bar, stage, service, exits, and accessible route.' },
  { key: 'outdoor_tent', label: 'Outdoor / tent', icon: TentTree, environment: 'outdoor', description: 'Tent boundary, power, loading, weather fallback, exits, and restroom zone.' },
] as const;

function scaffold(template: string, width: number, height: number) {
  const centerX = width / 2; const centerY = height / 2;
  const base = { walls: [{ id: 'boundary', points: [0, 0, width, 0, width, height, 0, height, 0, 0] }], doors: [], windows: [], pillars: [], zones: [] as any[] };
  if (template === 'ceremony') base.zones = [{ id: 'aisle', type: 'accessible_aisle', x: centerX - 30, y: 0, width: 60, height }, { id: 'focal', type: 'ceremony_focal', x: centerX - 80, y: 40, width: 160, height: 80 }, { id: 'exit', type: 'egress', x: 0, y: centerY - 40, width: 50, height: 80 }];
  if (template === 'cocktail') base.zones = [{ id: 'bar', type: 'bar', x: 40, y: 40, width: 180, height: 60 }, { id: 'service', type: 'service_zone', x: width - 180, y: 40, width: 140, height: 80 }, { id: 'circulation', type: 'circulation', x: centerX - 60, y: 0, width: 120, height }];
  if (template === 'reception') base.zones = [{ id: 'dance', type: 'dance_floor', x: centerX - 120, y: centerY - 90, width: 240, height: 180 }, { id: 'head', type: 'head_table', x: centerX - 140, y: 40, width: 280, height: 50 }, { id: 'bar', type: 'bar', x: width - 180, y: 40, width: 140, height: 70 }];
  if (template === 'outdoor_tent') base.zones = [{ id: 'tent', type: 'tent_boundary', x: 40, y: 40, width: width - 80, height: height - 80 }, { id: 'power', type: 'power_zone', x: 60, y: 60, width: 80, height: 60 }, { id: 'weather', type: 'weather_fallback', x: width - 180, y: height - 120, width: 120, height: 60 }];
  return base;
}

export function VenueSpaceScaffoldWizard({ orgId }: { orgId: string }) {
  const { toast } = useToast(); const qc = useQueryClient();
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]['key']>('reception');
  const [name, setName] = useState(''); const [width, setWidth] = useState(80); const [height, setHeight] = useState(60); const [capacity, setCapacity] = useState(120); const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');
  const { data } = useQuery({ queryKey: ['venues', orgId], queryFn: () => venuesSdk.list(orgId) });
  const create = useMutation({ mutationFn: () => venuesSdk.create(orgId, { name: name || TEMPLATES.find((t) => t.key === template)!.label, templateKey: template, environment: TEMPLATES.find((t) => t.key === template)!.environment as any, width, height, capacity, unitSystem: units, approvalStatus: 'draft', masterLayout: scaffold(template, width, height), metadata: { constraints: ['egress', 'accessibility', 'power', 'loading'] } }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['venues', orgId] }); toast({ title: 'Venue scaffold created', description: 'Review structural zones, then approve it for event layouts.', variant: 'success' }); setName(''); }, onError: (e: any) => toast({ title: 'Could not create space', description: e.message, variant: 'destructive' }) });
  return <Card><CardHeader><CardTitle>Create a venue space</CardTitle><CardDescription>Start from a wedding-ready scaffold. You can refine walls and structural elements in the canvas below.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 md:grid-cols-4">{TEMPLATES.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" onClick={() => setTemplate(item.key)} className={`rounded-xl border p-4 text-left ${template === item.key ? 'border-brand bg-brand-soft/30' : 'border-border hover:bg-surface-2'}`}><Icon className="mb-2 h-5 w-5 text-brand" /><strong className="block">{item.label}</strong><span className="mt-1 block text-xs text-fg-muted">{item.description}</span></button>; })}</div><div className="grid gap-4 md:grid-cols-4"><div><Label htmlFor="space-name">Space name</Label><Input id="space-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Grand reception" /></div><div><Label htmlFor="space-width">Width ({units === 'imperial' ? 'ft' : 'm'})</Label><Input id="space-width" type="number" min="1" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></div><div><Label htmlFor="space-height">Height ({units === 'imperial' ? 'ft' : 'm'})</Label><Input id="space-height" type="number" min="1" value={height} onChange={(e) => setHeight(Number(e.target.value))} /></div><div><Label htmlFor="space-capacity">Capacity</Label><Input id="space-capacity" type="number" min="0" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></div></div><div className="flex items-center gap-4"><label className="flex items-center gap-2 text-sm"><input type="radio" checked={units === 'imperial'} onChange={() => setUnits('imperial')} /> Feet / inches</label><label className="flex items-center gap-2 text-sm"><input type="radio" checked={units === 'metric'} onChange={() => setUnits('metric')} /> Metric</label><Button className="ml-auto" isLoading={create.isPending} onClick={() => create.mutate()}><Ruler className="h-4 w-4" /> Create draft scaffold</Button></div>{data?.venues?.length ? <div className="rounded-lg border border-border p-3 text-sm"><strong>Existing spaces</strong><div className="mt-2 grid gap-2 md:grid-cols-3">{data.venues.map((venue) => <span key={venue.id} className="rounded border border-border bg-surface-2 p-2">{venue.name} · {venue.width}×{venue.height} · {venue.capacity} guests</span>)}</div></div> : null}</CardContent></Card>;
}
