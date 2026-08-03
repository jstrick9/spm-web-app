import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Plus, Save, Trash2, Heart, Shield, Palette, Settings, Sparkles,
  Check, Upload, Image as ImageIcon, Trash, Sliders, Info, Eye, Lock,
  Music, Utensils, Link as LinkIcon, Compass, Users, CheckSquare, XSquare,
  HelpCircle, ChevronRight, Activity, Calendar, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { sdk } from '../../sdk';
import type { SdkCatalogItem } from '../../sdk/types';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { Skeleton } from '../../ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/Tabs';
import { useToast } from '../../ui/Toast';


// Re-exports from the decomposed manager modules (see ./managers/).
import { CatalogManager, VenueManager, DecorManager, BrandingManager, GuestPortalManager, AccessControlManager } from "./managers/index";

export { CatalogManager, VenueManager, DecorManager, BrandingManager, GuestPortalManager, AccessControlManager } from "./managers/index";

interface Props {
  orgId: string;
}

export type CatalogKind =
  | 'table'
  | 'chair'
  | 'fixture'
  | 'wall_style'
  | 'linen'
  | 'guideline'
  | 'spacing'
  | 'template'
  | 'decor'
  | 'venue'
  | 'branding'
  | 'guest_portal'
  | 'access_control';

const KINDS: { id: CatalogKind; label: string; desc: string; icon: string }[] = [
  { id: 'table', label: 'Tables', desc: 'Define shapes, dimensions, and capacities for floorplan tables.', icon: '⭕' },
  { id: 'chair', label: 'Chairs & Seating', desc: 'Manage styles, widths, and stocks of chairs.', icon: '🪑' },
  { id: 'fixture', label: 'Fixtures & Stages', desc: 'Stages, dance floors, bars, and podium sizes.', icon: '📦' },
  { id: 'wall_style', label: 'Wall Styles', desc: 'Architectural wall properties, thicknesses, and materials.', icon: '🧱' },
  { id: 'linen', label: 'Linens', desc: 'Tablecloths, runners, overlays, and draperies.', icon: '🧵' },
  { id: 'guideline', label: 'Guidelines', desc: 'Emergency exits, safety rings, and spacing rules.', icon: '🚒' },
  { id: 'spacing', label: 'Spacing Presets', desc: 'Spacing offsets between tables and row configurations.', icon: '📐' },
  { id: 'template', label: 'Layout Templates', desc: 'Seated, ceremony, and banquet table layouts.', icon: '📋' },
  { id: 'decor', label: 'Decor Inventory', desc: 'Manage floral arrangements, lights, arches, and floral photos.', icon: '🌸' },
  { id: 'venue', label: 'Venues', desc: 'Manage venue spaces, dimensions, capacities, and layout photos.', icon: '🏛️' },
  { id: 'branding', label: 'Venue Branding', desc: 'Customize logo, Google fonts, text colors, and brand palettes.', icon: '🎨' },
  { id: 'guest_portal', label: 'Guest Portal Studio', desc: 'Passcode gates, song lists, lodging rules, and visual portal settings.', icon: '🌐' },
  { id: 'access_control', label: 'User & Access Matrix', desc: 'Team invites, system roles, and interactive privilege matrix.', icon: '🛡️' },
];

export function CatalogScreen({ orgId }: Props) {
  const [activeTab, setActiveTab] = useState<CatalogKind>('table');

  return (
    <>
      <PageHeader
        title="Admin & Catalog Studio"
        description="Comprehensive operational workspace to configure structural floorplans, floral packages, and organization custom branding."
      />
      <PageBody>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation vertical list */}
          <div className="lg:col-span-1 space-y-1">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle px-3 mb-2">Operational Controls</h2>
            <div className="flex flex-col gap-1">
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setActiveTab(k.id)}
                  className={[
                    'w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-between',
                    activeTab === k.id
                      ? 'bg-brand text-brand-fg shadow-sm font-bold border-l-4 border-brand-strong'
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">{k.icon}</span>
                    {k.label}
                  </span>
                  <ChevronRight className={['h-3.5 w-3.5 opacity-40 transition-transform', activeTab === k.id ? 'translate-x-0.5 opacity-100' : ''].join(' ')} />
                </button>
              ))}
            </div>
          </div>

          {/* Configuration area */}
          <div className="lg:col-span-3">
            <Card className="min-h-[550px] border border-border bg-[#FDFBF7] shadow-lg">
              <CardHeader className="pb-4 border-b border-border/40">
                <CardTitle className="text-lg font-serif font-bold text-fg flex items-center gap-2">
                  <span className="text-xl">{KINDS.find((k) => k.id === activeTab)?.icon}</span>
                  {KINDS.find((k) => k.id === activeTab)?.label}
                </CardTitle>
                <CardDescription className="text-xs text-fg-subtle">
                  {KINDS.find((k) => k.id === activeTab)?.desc}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {activeTab === 'branding' ? (
                  <BrandingManager orgId={orgId} />
                ) : activeTab === 'decor' ? (
                  <DecorManager orgId={orgId} />
                ) : activeTab === 'venue' ? (
                  <VenueManager orgId={orgId} />
                ) : activeTab === 'guest_portal' ? (
                  <GuestPortalManager orgId={orgId} />
                ) : activeTab === 'access_control' ? (
                  <AccessControlManager orgId={orgId} />
                ) : (
                  <CatalogManager orgId={orgId} kind={activeTab} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

// ─── 1. Interactive SVG Shape Previews ─────────────────────────────────────
export function renderShapePreview(shape: string, color: string = '#E5E5E5', capacity: number = 8) {
  const size = 64;
  const radius = size / 2;
  const stroke = '#3F3F46';

  const seatRadius = 4;
  const seats = Array.from({ length: Math.min(16, Math.max(0, capacity)) }).map((_, i, arr) => {
    const angle = (i * 2 * Math.PI) / arr.length;
    const offset = radius - 8;
    const cx = radius + offset * Math.cos(angle);
    const cy = radius + offset * Math.sin(angle);
    return <circle key={i} cx={cx} cy={cy} r={seatRadius} fill="#D4AF37" stroke="#333" strokeWidth="0.5" />;
  });

  return (
    <div className="relative h-16 w-16 bg-surface-2 rounded-lg border border-border flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
      <svg className="h-full w-full p-1" viewBox="0 0 64 64">
        {shape === 'round' && <circle cx={radius} cy={radius} r={radius - 12} fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'rect' && <rect x="14" y="20" width={size - 28} height={size - 40} rx="2" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'square' && <rect x="16" y="16" width={size - 32} height={size - 32} rx="2" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'oval' && <ellipse cx={radius} cy={radius} rx={radius - 12} ry={radius - 18} fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'triangle' && <polygon points="32,14 50,48 14,40" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'semicircle' && <path d="M 14,40 A 18,18 0 0,1 50,40 L 14,40" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'hexagon' && <polygon points="32,14 48,22 48,42 32,50 16,42 16,22" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {shape === 'octagon' && <polygon points="32,13 45,19 49,32 45,45 32,51 19,45 15,32 19,19" fill={color} stroke={stroke} strokeWidth="1.5" />}
        {seats}
      </svg>
    </div>
  );
}

// ─── 2. Generic Catalog Item Manager with Quick-Add Presets ─────────────────

// ─── 3. Venue Manager with Environment & Local Photos ──

// ─── Decor Manager with Image Upload ───────────────────────────────────────

// ─── Branding Manager with Fonts, Welcomes, and Previews ─────────────────

// ─── 6. Guest Portal Studio ────────────────────────────────────────────────

// ─── 7. Access Control Manager & Privilege Grid ──────────────────────────

