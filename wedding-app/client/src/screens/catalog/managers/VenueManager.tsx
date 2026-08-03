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
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { Skeleton } from '../../../ui/Skeleton';
import { useToast } from '../../../ui/Toast';

export function VenueManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newVenueName, setNewVenueName] = useState('');
  const [capacity, setCapacity] = useState(150);
  const [width, setWidth] = useState(60);
  const [height, setHeight] = useState(40);
  const [environment, setEnvironment] = useState<'indoor' | 'outdoor' | 'both'>('indoor');
  
  const [venueCategory, setVenueCategory] = useState<'reception' | 'ceremony' | 'cocktail' | 'lodging' | 'other'>('reception');
  const [floorPattern, setFloorPattern] = useState<'wood' | 'concrete' | 'grass' | 'carpet' | 'tile'>('wood');
  const [canvasWidth, setCanvasWidth] = useState<number>(140);
  const [canvasHeight, setCanvasHeight] = useState<number>(120);
  const [isMasterSpace, setIsMasterSpace] = useState<boolean>(true);

  const [venuePhoto, setVenuePhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: venueData, isLoading } = useQuery({
    queryKey: ['venues', orgId],
    queryFn: () => sdk.venues.list(orgId),
  });

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setVenuePhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoadPreset = (presetType: 'reception' | 'cocktail' | 'ceremony' | 'lodging') => {
    if (presetType === 'reception') {
      setNewVenueName('Reception Venue'); setCapacity(150); setWidth(60); setHeight(40);
      setEnvironment('indoor'); setVenueCategory('reception'); setFloorPattern('wood');
      setCanvasWidth(140); setCanvasHeight(120); setIsMasterSpace(true);
    } else if (presetType === 'cocktail') {
      setNewVenueName('Cocktail Hour Venue'); setCapacity(75); setWidth(40); setHeight(30);
      setEnvironment('both'); setVenueCategory('cocktail'); setFloorPattern('concrete');
      setCanvasWidth(100); setCanvasHeight(90); setIsMasterSpace(true);
    } else if (presetType === 'ceremony') {
      setNewVenueName('Ceremony Venue'); setCapacity(200); setWidth(80); setHeight(60);
      setEnvironment('outdoor'); setVenueCategory('ceremony'); setFloorPattern('grass');
      setCanvasWidth(160); setCanvasHeight(140); setIsMasterSpace(true);
    } else if (presetType === 'lodging') {
      setNewVenueName('Lodging Cabin Venue'); setCapacity(12); setWidth(50); setHeight(30);
      setEnvironment('both'); setVenueCategory('lodging'); setFloorPattern('wood');
      setCanvasWidth(110); setCanvasHeight(90); setIsMasterSpace(false);
    }
    toast({ title: 'Venue preset parameters loaded successfully' });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      sdk.venues.create(orgId, {
        name: newVenueName,
        capacity,
        width,
        height,
        environment,
        category: venueCategory,
        style: {
          photo: venuePhoto || undefined,
          pattern: floorPattern,
          canvasWidth,
          canvasHeight,
          isMaster: isMasterSpace
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues', orgId] });
      setNewVenueName('');
      setVenuePhoto(null);
      toast({ title: 'Venue space created successfully', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to create venue space', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.venues.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['venues', orgId] });
      toast({ title: 'Venue deleted successfully', variant: 'success' });
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />;

  const venues = venueData?.venues ?? [];

  return (
    <div className="space-y-4">
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
            <Sparkles className="h-4 w-4 text-brand animate-pulse" /> Load Venue Presets
          </h4>
          <p className="text-[10px] text-fg-subtle">Instantly load typical venue space presets with corresponding dimensions and layouts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={() => handleLoadPreset('reception')}>🎉 Reception</Button>
          <Button size="xs" variant="outline" onClick={() => handleLoadPreset('cocktail')}>🍸 Cocktail Hour</Button>
          <Button size="xs" variant="outline" onClick={() => handleLoadPreset('ceremony')}>💒 Ceremony</Button>
          <Button size="xs" variant="outline" onClick={() => handleLoadPreset('lodging')}>🏡 Lodging Cabin</Button>
        </div>
      </div>

      <div className="bg-surface-2/40 p-4 rounded-xl border border-border space-y-4 font-semibold">
        <h4 className="text-xs font-bold text-fg font-serif">Add New Venue Workspace</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="sm:col-span-2">
            <Label htmlFor="venue-name" className="text-[10px]">Venue Name</Label>
            <Input id="venue-name" placeholder="Grand Ballroom, South Garden..." value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)} className="h-9 text-xs mt-1" />
          </div>
          <div>
            <Label htmlFor="venue-cap" className="text-[10px]">Max Capacity</Label>
            <Input id="venue-cap" type="number" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value))} className="h-9 text-xs mt-1" />
          </div>
          <div>
            <Label htmlFor="venue-env" className="text-[10px]">Environment</Label>
            <select
              id="venue-env"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as any)}
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
            >
              <option value="indoor">🏛️ Indoor Hall</option>
              <option value="outdoor">🌿 Outdoor Garden</option>
              <option value="both">✨ Both Indoor/Outdoor</option>
            </select>
          </div>
          <div>
            <Label htmlFor="venue-cat" className="text-[10px]">Venue Category</Label>
            <select
              id="venue-cat"
              value={venueCategory}
              onChange={(e) => setVenueCategory(e.target.value as any)}
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
            >
              <option value="reception">Reception / Banquet</option>
              <option value="ceremony">Ceremony / Row seating</option>
              <option value="cocktail">Cocktail Hour</option>
              <option value="lodging">Lodging Accommodations</option>
              <option value="other">Other space</option>
            </select>
          </div>
          <div>
            <Label htmlFor="venue-pat" className="text-[10px]">Floor pattern</Label>
            <select
              id="venue-pat"
              value={floorPattern}
              onChange={(e) => setFloorPattern(e.target.value as any)}
              className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
            >
              <option value="wood">🪓 Hardwood Plank</option>
              <option value="concrete">🧱 Raw Concrete</option>
              <option value="grass">🌿 Outdoor Grass / Lawn</option>
              <option value="carpet">🧶 Luxury Carpet</option>
              <option value="tile">🔲 Ceramic Tile</option>
            </select>
          </div>
          <div>
            <Label htmlFor="venue-w" className="text-[10px]">Width (ft)</Label>
            <Input id="venue-w" type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
          </div>
          <div>
            <Label htmlFor="venue-h" className="text-[10px]">Length / Height (ft)</Label>
            <Input id="venue-h" type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
          </div>

          <div>
            <Label htmlFor="venue-cw" className="text-[10px]">Canvas Envelope Width (ft)</Label>
            <Input id="venue-cw" type="number" value={canvasWidth} onChange={(e) => setCanvasWidth(parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
          </div>
          <div>
            <Label htmlFor="venue-ch" className="text-[10px]">Canvas Envelope Height (ft)</Label>
            <Input id="venue-ch" type="number" value={canvasHeight} onChange={(e) => setCanvasHeight(parseInt(e.target.value))} className="h-9 mt-1 text-xs" />
          </div>

          <div className="col-span-2 flex items-center gap-2 mt-4">
             <input
               type="checkbox"
               id="venue-master"
               checked={isMasterSpace}
               onChange={(e) => setIsMasterSpace(e.target.checked)}
               className="rounded border-border accent-brand h-4 w-4 cursor-pointer"
             />
             <Label htmlFor="venue-master" className="text-xs cursor-pointer text-fg-subtle">Set as organization primary master layout space</Label>
          </div>
        </div>

        {/* Upload venue photo */}
        <div className="flex items-center gap-4">
          <input type="file" accept="image/*" onChange={handlePhotoUpload} ref={fileInputRef} className="hidden" />
          <Button size="xs" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1" /> {venuePhoto ? 'Change Space Layout Photo' : 'Upload Space Layout Photo'}
          </Button>
          {venuePhoto && (
            <div className="flex items-center gap-2">
              <img src={venuePhoto} alt="Space Layout" className="h-10 w-10 object-cover rounded-md border border-border" />
              <Button size="xs" variant="ghost" className="text-danger" onClick={() => setVenuePhoto(null)}>
                <Trash className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <Button onClick={() => createMutation.mutate()} disabled={!newVenueName.trim() || createMutation.isPending} className="w-full h-10 font-bold">
          Create Venue
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {venues.length === 0 ? (
          <div className="col-span-2 text-center text-xs text-fg-muted py-8 border border-dashed rounded-lg bg-surface-2/20">No venues added yet.</div>
        ) : (
          venues.map((v: any) => {
            const style = typeof v.style === 'string' ? JSON.parse(v.style || '{}') : (v.style || {});
            return (
              <Card key={v.id} className="p-3.5 flex items-center justify-between border-border bg-[#FDFBF7] shadow-sm">
                <div className="flex items-center gap-3">
                  {style.photo ? (
                    <img src={style.photo} alt={v.name} className="h-12 w-12 object-cover rounded-md border border-border shadow-sm" />
                  ) : (
                    <div className="h-12 w-12 bg-surface-2 rounded-md border border-border flex items-center justify-center text-fg-subtle shadow-sm">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
                       {v.name}
                       {style.isMaster && <Badge variant="warning" className="text-[8px] uppercase px-1 py-0 font-bold">Master</Badge>}
                    </h4>
                    <p className="text-[10px] text-fg-subtle mt-0.5 capitalize">
                      {v.width}ft × {v.height}ft · {v.capacity} guests · {v.environment} · {style.pattern || 'wood'} floor
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                   {/* Quick duplicate button (Step 9 full parity) */}
                   <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        sdk.venues.create(orgId, {
                           name: `${v.name} (Copy)`,
                           capacity: v.capacity,
                           width: v.width,
                           height: v.height,
                           environment: v.environment,
                           category: v.category,
                           style
                        }).then(() => {
                           qc.invalidateQueries({ queryKey: ['venues', orgId] });
                           toast({ title: 'Venue space duplicated successfully' });
                        });
                      }}
                      className="h-8 w-8 text-brand hover:bg-brand-soft/30 rounded"
                      title="Duplicate"
                   >
                      <Plus className="h-3.5 w-3.5" />
                   </Button>

                   <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:bg-danger/10" onClick={() => { if (window.confirm(`Delete ${v.name}? Deletion is blocked while event layouts reference this space.`)) deleteMutation.mutate(v.id); }}>
                     <Trash2 className="w-4 h-4" />
                   </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
