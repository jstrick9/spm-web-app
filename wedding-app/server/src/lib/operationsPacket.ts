import { deflateRawSync } from 'node:zlib';
import type { GuestRow } from '../db/repos/guests.js';
import type { LayoutRow } from '../db/repos/layouts.js';
import type { StaffTaskRow } from '../db/repos/staff.js';
import type { TimelineEventRow } from '../db/repos/timeline.js';
import type { VendorRow } from '../db/repos/vendors.js';

export interface OperationsPacketData {
  exportedAt: string;
  event: Record<string, any>;
  guests: GuestRow[];
  vendors: VendorRow[];
  timeline: TimelineEventRow[];
  staffTasks: StaffTaskRow[];
  layouts: LayoutRow[];
}

interface PacketFile {
  name: string;
  content: Buffer;
  compress?: boolean;
}

interface PacketSection {
  title: string;
  body: string[];
}

interface LayoutPreview {
  layout: LayoutRow;
  items: Array<Record<string, any>>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
  diagnostics: {
    tables: number;
    seats: number;
    assignedSeats: number;
    vendorZones: number;
    exits: number;
    adaPaths: number;
    powerSources: number;
    warnings: string[];
  };
  svg: string;
}

const BRAND = 'Wedding Venue Intelligence';
const SUB_BRAND = 'SPM Venue Manager Operations Packet';
const BRAND_HEX = '#800020';
const BRAND_DARK_HEX = '#4A0012';
const BRAND_GOLD_HEX = '#C8A951';
const BRAND_SOFT_HEX = '#F8F1F4';

function safe(value: unknown, fallback = 'TBD'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function money(cents: unknown): string {
  const n = typeof cents === 'number' ? cents : Number(cents || 0);
  return `$${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'string') return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function textSection(title: string, rows: string[]): string {
  return [`## ${title}`, ...rows.map((r) => (r.trim() ? r : '—')), ''].join('\n');
}

function itemLabel(item: Record<string, any>): string {
  return safe(item.label || item.name || item.title || item.type, 'Item');
}

function itemDimension(item: Record<string, any>, axis: 'w' | 'h'): number {
  const fallback = item.type === 'chair' || item.type === 'seat' ? 18 : item.type === 'vendor_zone' ? 90 : 48;
  if (item.radius) return Number(item.radius) * 2;
  return Number(axis === 'w' ? item.width : item.height) || fallback;
}

function isTable(item: Record<string, any>): boolean {
  return ['round_table', 'rect_table', 'table'].includes(String(item.type));
}

function isSeat(item: Record<string, any>): boolean {
  return ['chair', 'seat'].includes(String(item.type));
}

function buildLayoutPreviews(layouts: LayoutRow[]): LayoutPreview[] {
  return layouts.slice(0, 6).map((layout) => {
    const payload = parseJson<Record<string, any>>(layout.payload, {});
    const items = Array.isArray(payload.items) ? payload.items as Array<Record<string, any>> : [];
    const xs = items.map((item) => Number(item.x) || 0);
    const ys = items.map((item) => Number(item.y) || 0);
    const minX = Math.min(0, ...xs) - 80;
    const minY = Math.min(0, ...ys) - 80;
    const maxX = Math.max(800, ...items.map((item) => (Number(item.x) || 0) + itemDimension(item, 'w'))) + 80;
    const maxY = Math.max(500, ...items.map((item) => (Number(item.y) || 0) + itemDimension(item, 'h'))) + 80;
    const bounds = { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    const vendorZones = items.filter((i) => i.type === 'vendor_zone');
    const exits = items.filter((i) => ['fire_exit', 'exit'].includes(String(i.type)) || /exit/i.test(itemLabel(i)));
    const adaPaths = items.filter((i) => ['ada_path', 'walkway', 'aisle'].includes(String(i.type)) || /ada|access/i.test(itemLabel(i)));
    const powerSources = items.filter((i) => ['power_outlet', 'high_voltage_source'].includes(String(i.type)));
    const seats = items.filter(isSeat);
    const tables = items.filter(isTable);
    const warnings = [
      ...(layout.approval_status === 'approved' ? [] : ['Layout is not approved.']),
      ...(exits.length ? [] : ['Fire exits not marked.']),
      ...(adaPaths.length ? [] : ['ADA/accessibility route not marked.']),
      ...(vendorZones.length && !items.some((i) => i.type === 'load_in_path') ? ['Vendor load-in path not marked.'] : []),
    ];
    const diagnostics = { tables: tables.length, seats: seats.length, assignedSeats: seats.filter((s) => s.guestId).length, vendorZones: vendorZones.length, exits: exits.length, adaPaths: adaPaths.length, powerSources: powerSources.length, warnings };
    return { layout, items, bounds, diagnostics, svg: renderLayoutSvg(layout, items, bounds, diagnostics) };
  });
}

function svgEscape(value: unknown): string {
  return safe(value, '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] || m));
}

function renderLayoutSvg(layout: LayoutRow, items: Array<Record<string, any>>, bounds: LayoutPreview['bounds'], diagnostics: LayoutPreview['diagnostics']): string {
  const width = 1200;
  const height = 800;
  const scale = Math.min((width - 96) / bounds.width, (height - 170) / bounds.height);
  const tx = 48 - bounds.minX * scale;
  const ty = 118 - bounds.minY * scale;
  const rects = items.slice(0, 500).map((item) => {
    const x = (Number(item.x) || 0) * scale + tx;
    const y = (Number(item.y) || 0) * scale + ty;
    const w = Math.max(8, itemDimension(item, 'w') * scale);
    const h = Math.max(8, itemDimension(item, 'h') * scale);
    const label = svgEscape(itemLabel(item));
    const type = String(item.type || 'item');
    const fill = type === 'vendor_zone' ? '#DBEAFE' : isTable(item) ? '#FDE68A' : isSeat(item) ? '#DCFCE7' : /exit/i.test(label) ? '#FEE2E2' : type.includes('power') ? '#E0E7FF' : '#F3F4F6';
    const stroke = type === 'vendor_zone' ? '#2563EB' : isTable(item) ? '#B45309' : isSeat(item) ? '#16A34A' : /exit/i.test(label) ? '#DC2626' : '#6B7280';
    if (item.radius || isSeat(item) || type === 'round_table') {
      const r = Math.max(5, Math.min(w, h) / 2);
      return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y + r + 12).toFixed(1)}" text-anchor="middle" font-size="12" fill="#374151">${label}</text></g>`;
    }
    return `<g><rect x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="#374151">${label}</text></g>`;
  }).join('\n');
  const warnings = diagnostics.warnings.length ? diagnostics.warnings.map((w) => `<tspan x="72" dy="18">• ${svgEscape(w)}</tspan>`).join('') : '<tspan x="72" dy="18">No layout warnings detected.</tspan>';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  <rect x="0" y="0" width="${width}" height="86" fill="${BRAND_HEX}"/>
  <text x="48" y="38" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#FFFFFF">${svgEscape(layout.name)} Floorplan Preview</text>
  <text x="48" y="65" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#FDE7EF">${svgEscape(BRAND)} · Revision ${layout.revision} · ${svgEscape(layout.approval_status)}</text>
  <rect x="48" y="110" width="1104" height="520" rx="14" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="2"/>
  ${rects || '<text x="600" y="370" text-anchor="middle" font-family="Arial" font-size="20" fill="#64748B">No canvas objects available in this floorplan.</text>'}
  <rect x="48" y="652" width="530" height="104" rx="12" fill="${BRAND_SOFT_HEX}" stroke="#E9CDD6"/>
  <text x="72" y="682" font-family="Arial" font-size="16" font-weight="700" fill="${BRAND_HEX}">Readiness</text>
  <text x="72" y="708" font-family="Arial" font-size="14" fill="#334155">Tables ${diagnostics.tables} · Seats ${diagnostics.seats} · Assigned ${diagnostics.assignedSeats}</text>
  <text x="72" y="732" font-family="Arial" font-size="14" fill="#334155">Vendor zones ${diagnostics.vendorZones} · Exits ${diagnostics.exits} · ADA paths ${diagnostics.adaPaths} · Power ${diagnostics.powerSources}</text>
  <rect x="606" y="652" width="546" height="104" rx="12" fill="#FFFBEB" stroke="#FDE68A"/>
  <text x="630" y="680" font-family="Arial" font-size="16" font-weight="700" fill="#92400E">Manager checks</text>
  <text x="630" y="694" font-family="Arial" font-size="13" fill="#78350F">${warnings}</text>
</svg>`;
}

function buildSections(data: OperationsPacketData, previews = buildLayoutPreviews(data.layouts)): PacketSection[] {
  const { event, guests, vendors, timeline, staffTasks, layouts, exportedAt } = data;
  const attending = guests.filter((g) => ['attending', 'confirmed'].includes(String(g.rsvp_status))).length;
  const guestExceptions = guests.filter((g) => g.dietary_restrictions || g.accessibility_notes || g.room_assignment || g.table_assignment).slice(0, 30);
  const vendorExceptions = vendors.filter((v) => {
    const meta = parseJson<Record<string, any>>(v.metadata, {});
    return meta.needsOwnerDecision || meta.noShowWorkflow || !v.phone || !v.contact_name;
  });
  const incidentTasks = staffTasks.filter((t) => t.status === 'blocked' || t.priority === 'critical' || parseJson<string[]>(t.tags, []).some((tag) => /incident|damage|safety|blocked/i.test(tag)));
  const openCloseout = staffTasks.filter((t) => t.phase === 'post-event' && t.status !== 'completed');

  return [
    {
      title: 'BEO / Event Operating Brief',
      body: [
        `${SUB_BRAND}`,
        `Generated: ${exportedAt}`,
        `Event: ${safe(event.title)}`,
        `Date: ${safe(event.start_date)}${event.end_date && event.end_date !== event.start_date ? ` to ${event.end_date}` : ''}`,
        `Status: ${safe(event.status)}`,
        `Expected guests: ${safe(event.guest_count || attending || guests.length)}`,
        `Budget visibility: ${event.budget_cents ? money(event.budget_cents) : 'Manager-safe packet; detailed ledger remains in Budget.'}`,
        `Readiness counts: ${guests.length} guests · ${vendors.length} vendors · ${timeline.length} run-sheet items · ${staffTasks.length} staff tasks · ${layouts.length} floorplans`,
        `Manager rule: resolve critical incident/vendor/load-in blockers first, then confirm floorplan, call sheet, closeout owner, and client/planner sign-off.`,
      ],
    },
    {
      title: 'Run Sheet',
      body: timeline.length
        ? timeline.map((item, i) => `${i + 1}. ${safe(item.starts_at)} — ${safe(item.title)} (${safe(item.category, 'general')})${item.location ? ` @ ${item.location}` : ''}${item.assigned_to ? ` · owner: ${item.assigned_to}` : ''}${item.notes ? ` · notes: ${item.notes}` : ''}`)
        : ['No timeline items found. Add load-in, ceremony, cocktail hour, dinner, speeches, dancing, last call, strike, and venue close tasks before publishing.'],
    },
    {
      title: 'Call Sheet',
      body: [
        ...vendors.map((v) => `Vendor · ${safe(v.category, 'Vendor')} · ${safe(v.name)} · ${safe(v.contact_name, 'contact TBD')} · ${safe(v.phone, 'phone TBD')} · ${safe(v.email, 'email TBD')}`),
        ...staffTasks.filter((t) => t.assignee_name || t.assignee_phone || t.assignee_email).map((t) => `Staff · ${safe(t.assignee_name)} · ${safe(t.assignee_phone, 'phone TBD')} · ${safe(t.assignee_email, 'email TBD')} · task: ${safe(t.title)}`),
        ...(vendors.length || staffTasks.some((t) => t.assignee_name || t.assignee_phone || t.assignee_email) ? [] : ['No contacts found. Add vendor contacts and staff assignee phones before event day.']),
      ],
    },
    {
      title: 'Floorplan Summary',
      body: previews.length
        ? previews.map((p) => `${safe(p.layout.name)} · status: ${safe(p.layout.approval_status)} · revision: ${safe(p.layout.revision)} · tables ${p.diagnostics.tables} · seats ${p.diagnostics.seats} · vendor zones ${p.diagnostics.vendorZones} · exits ${p.diagnostics.exits} · ADA paths ${p.diagnostics.adaPaths} · preview file included`)
        : ['No floorplan attached. Confirm ceremony/reception layouts, rain plan, ADA paths, fire egress, bars, parking/shuttle zones, and vendor load-in routes.'],
    },
    {
      title: 'Vendor Load-In Packet',
      body: vendors.length
        ? vendors.map((v, i) => {
            const meta = parseJson<Record<string, any>>(v.metadata, {});
            const arrival = meta.arrivalTime || meta.arrival_time || meta.loadInTime || 'arrival TBD';
            const route = meta.loadInRoute || meta.load_in_route || meta.zone || 'route/zone TBD';
            const risk = vendorExceptions.some((x) => x.id === v.id) ? 'CHECK BEFORE DOORS' : 'ready review';
            return `${i + 1}. ${safe(v.name)} (${safe(v.category)}) · ${safe(v.contact_name, 'contact TBD')} ${safe(v.phone, 'phone TBD')} · ${arrival} · ${route} · ${risk}${v.notes ? ` · notes: ${v.notes}` : ''}`;
          })
        : ['No vendors assigned. Confirm catering, bar, DJ/band, florist, planner, photo/video, rentals, transportation, security, and cleanup contacts.'],
    },
    {
      title: 'Guest Service Exceptions',
      body: guestExceptions.length
        ? guestExceptions.map((g) => `${safe(g.full_name)} · RSVP ${safe(g.rsvp_status)} · table ${safe(g.table_assignment, 'TBD')} · room ${safe(g.room_assignment, 'TBD')} · dietary ${safe(g.dietary_restrictions, 'none')} · accessibility ${safe(g.accessibility_notes, 'none')}`)
        : ['No dietary/accessibility/table/room exceptions found in the guest list.'],
    },
    {
      title: 'Incident Report',
      body: [
        ...(incidentTasks.length ? incidentTasks.map((t) => `${safe(t.priority).toUpperCase()} · ${safe(t.title)} · status ${safe(t.status)} · owner ${safe(t.assignee_name, 'unassigned')} · ${safe(t.notes, 'no notes')}`) : ['No active critical/blocked incident tasks found at export time.']),
        'Blank incident fields: time, location, reporter, involved guests/vendors/staff, immediate action, photos/evidence, owner notified, follow-up owner, resolved time.',
      ],
    },
    {
      title: 'Closeout Checklist',
      body: [
        ...(openCloseout.length ? openCloseout.map((t) => `Open post-event task · ${safe(t.title)} · owner ${safe(t.assignee_name, 'unassigned')} · due ${safe(t.due_at)}`) : ['No open post-event staff tasks found. Use this checklist for end-of-night verification.']),
        'Bar/alcohol reconciled and compliant.',
        'Lost-and-found photographed, tagged, and stored.',
        'Damage walkthrough completed with photos and client/planner sign-off.',
        'Rentals/equipment counted, missing/damaged items escalated, vendor return confirmed.',
        'Trash, restrooms, catering prep, ceremony/reception spaces, parking/shuttle areas checked.',
        'Post-event debrief notes captured for continuous improvement.',
      ],
    },
  ];
}

export function buildOperationsPacketManifest(data: OperationsPacketData) {
  const previews = buildLayoutPreviews(data.layouts);
  const sections = buildSections(data, previews);
  return {
    exportedAt: data.exportedAt,
    type: 'branded_event_operations_packet',
    brand: BRAND,
    formatVersion: 2,
    compression: 'deflate',
    includes: ['branded PDF', 'cover page', 'QR-style quick reference', 'floorplan SVG previews', 'manifest', 'section text files'],
    event: {
      id: data.event.id,
      title: data.event.title,
      date: data.event.start_date,
      status: data.event.status,
      organizationId: data.event.organization_id,
    },
    summary: {
      guestCount: data.guests.length,
      vendorCount: data.vendors.length,
      timelineItems: data.timeline.length,
      staffTasks: data.staffTasks.length,
      layouts: data.layouts.length,
      floorplanPreviews: previews.length,
      sections: sections.map((s) => s.title),
    },
  };
}

export function buildOperationsPacketMarkdown(data: OperationsPacketData): string {
  const previews = buildLayoutPreviews(data.layouts);
  const sections = buildSections(data, previews);
  const title = `${BRAND}\n${SUB_BRAND}\n${safe(data.event.title)}\nExported ${data.exportedAt}\n`;
  return [title, ...sections.map((section) => textSection(section.title, section.body))].join('\n');
}

function escapePdfText(text: string): string {
  return text.replace(/[\\()]/g, (m) => `\\${m}`).replace(/[\r\n\t]/g, ' ');
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

function pdfColor(hex: string, op: 'rg' | 'RG' = 'rg'): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${op}`;
}

function wrapText(text: string, max = 92): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function textAt(x: number, y: number, text: string, size = 10, font = 'F1', color = '#111827'): string[] {
  return ['BT', pdfColor(color), `/${font} ${size} Tf`, `${x} ${y} Td`, `(${escapePdfText(text)}) Tj`, 'ET'];
}

function fillRect(x: number, y: number, w: number, h: number, color: string): string {
  return `${pdfColor(color)} ${x} ${y} ${w} ${h} re f`;
}

function strokeRect(x: number, y: number, w: number, h: number, color: string, width = 1): string {
  return `${pdfColor(color, 'RG')} ${width} w ${x} ${y} ${w} ${h} re S`;
}

function drawQrMarker(seed: string, x: number, y: number, cell = 7): string[] {
  let hash = 2166136261;
  for (const ch of seed) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  const commands = [fillRect(x - 8, y - 8, cell * 17 + 16, cell * 17 + 16, '#FFFFFF'), strokeRect(x - 8, y - 8, cell * 17 + 16, cell * 17 + 16, BRAND_HEX, 1)];
  for (let row = 0; row < 17; row += 1) {
    for (let col = 0; col < 17; col += 1) {
      const finder = (row < 5 && col < 5) || (row < 5 && col > 11) || (row > 11 && col < 5);
      const bit = finder || (((hash >>> ((row + col) % 24)) ^ (row * 13 + col * 7 + hash)) & 3) === 0;
      if (bit) commands.push(fillRect(x + col * cell, y + (16 - row) * cell, cell, cell, finder ? BRAND_HEX : '#111827'));
    }
  }
  return commands;
}

function drawLayoutPdf(preview: LayoutPreview, x: number, y: number, w: number, h: number): string[] {
  const commands = [fillRect(x, y, w, h, '#F8FAFC'), strokeRect(x, y, w, h, '#CBD5E1', 1)];
  const scale = Math.min((w - 24) / preview.bounds.width, (h - 54) / preview.bounds.height);
  const tx = x + 12 - preview.bounds.minX * scale;
  const ty = y + 14 - preview.bounds.minY * scale;
  for (const item of preview.items.slice(0, 220)) {
    const ix = (Number(item.x) || 0) * scale + tx;
    const iy = (Number(item.y) || 0) * scale + ty;
    const iw = Math.max(4, itemDimension(item, 'w') * scale);
    const ih = Math.max(4, itemDimension(item, 'h') * scale);
    const type = String(item.type || 'item');
    const label = itemLabel(item);
    const fill = type === 'vendor_zone' ? '#DBEAFE' : isTable(item) ? '#FDE68A' : isSeat(item) ? '#DCFCE7' : /exit/i.test(label) ? '#FEE2E2' : type.includes('power') ? '#E0E7FF' : '#F3F4F6';
    commands.push(fillRect(ix - iw / 2, iy - ih / 2, iw, ih, fill));
    commands.push(strokeRect(ix - iw / 2, iy - ih / 2, iw, ih, '#6B7280', 0.5));
  }
  commands.push(...textAt(x + 12, y + h - 24, `${preview.layout.name} · rev ${preview.layout.revision} · ${preview.layout.approval_status}`, 11, 'F2', BRAND_HEX));
  commands.push(...textAt(x + 12, y + h - 42, `Tables ${preview.diagnostics.tables} · Seats ${preview.diagnostics.seats} · Vendor zones ${preview.diagnostics.vendorZones} · Exits ${preview.diagnostics.exits} · ADA ${preview.diagnostics.adaPaths}`, 8, 'F1', '#334155'));
  return commands;
}

function buildDesignedPdf(data: OperationsPacketData): Buffer {
  const previews = buildLayoutPreviews(data.layouts);
  const sections = buildSections(data, previews);
  const pageWidth = 612;
  const pageHeight = 792;
  const objects: string[] = [];
  const add = (content: string) => { objects.push(content); return objects.length; };
  const catalogId = add('');
  const pagesId = add('');
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds: number[] = [];

  const addPage = (commands: string[]) => {
    const footer = [strokeRect(54, 35, 504, 0.5, '#E5E7EB', 0.5), ...textAt(54, 20, BRAND, 8, 'F1', '#6B7280'), ...textAt(430, 20, `Generated ${data.exportedAt.slice(0, 10)}`, 8, 'F1', '#6B7280')];
    const stream = [...commands, ...footer].join('\n');
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  };

  const openTasks = data.staffTasks.filter((t) => t.status !== 'completed').length;
  const criticalTasks = data.staffTasks.filter((t) => t.priority === 'critical' || t.status === 'blocked').length;
  const vendorContactsMissing = data.vendors.filter((v) => !v.phone || !v.contact_name).length;
  const title = safe(data.event.title, 'Event Operations Packet');

  addPage([
    fillRect(0, 0, pageWidth, pageHeight, '#FFFFFF'),
    fillRect(0, 612, pageWidth, 180, BRAND_HEX),
    fillRect(0, 586, pageWidth, 26, BRAND_GOLD_HEX),
    ...textAt(54, 724, BRAND, 18, 'F2', '#FFFFFF'),
    ...textAt(54, 692, SUB_BRAND, 13, 'F1', '#FDE7EF'),
    ...textAt(54, 640, title, 30, 'F2', '#FFFFFF'),
    ...textAt(54, 612, `${safe(data.event.start_date)} · ${safe(data.event.status)} · ${safe(data.event.guest_count || data.guests.length)} guests`, 13, 'F1', '#FFFFFF'),
    fillRect(54, 440, 150, 82, BRAND_SOFT_HEX), strokeRect(54, 440, 150, 82, '#E9CDD6', 1), ...textAt(72, 492, 'Guests', 10, 'F2', BRAND_HEX), ...textAt(72, 460, String(data.guests.length), 26, 'F2', BRAND_DARK_HEX),
    fillRect(231, 440, 150, 82, '#F8FAFC'), strokeRect(231, 440, 150, 82, '#CBD5E1', 1), ...textAt(249, 492, 'Vendors', 10, 'F2', BRAND_HEX), ...textAt(249, 460, String(data.vendors.length), 26, 'F2', BRAND_DARK_HEX),
    fillRect(408, 440, 150, 82, '#FFFBEB'), strokeRect(408, 440, 150, 82, '#FDE68A', 1), ...textAt(426, 492, 'Run sheet', 10, 'F2', BRAND_HEX), ...textAt(426, 460, String(data.timeline.length), 26, 'F2', BRAND_DARK_HEX),
    fillRect(54, 324, 150, 82, '#F8FAFC'), strokeRect(54, 324, 150, 82, '#CBD5E1', 1), ...textAt(72, 376, 'Open tasks', 10, 'F2', BRAND_HEX), ...textAt(72, 344, String(openTasks), 26, 'F2', BRAND_DARK_HEX),
    fillRect(231, 324, 150, 82, criticalTasks ? '#FEF2F2' : '#F0FDF4'), strokeRect(231, 324, 150, 82, criticalTasks ? '#FCA5A5' : '#BBF7D0', 1), ...textAt(249, 376, 'Critical/blockers', 10, 'F2', BRAND_HEX), ...textAt(249, 344, String(criticalTasks), 26, 'F2', criticalTasks ? '#B91C1C' : '#166534'),
    fillRect(408, 324, 150, 82, vendorContactsMissing ? '#FEF2F2' : '#F0FDF4'), strokeRect(408, 324, 150, 82, vendorContactsMissing ? '#FCA5A5' : '#BBF7D0', 1), ...textAt(426, 376, 'Vendor gaps', 10, 'F2', BRAND_HEX), ...textAt(426, 344, String(vendorContactsMissing), 26, 'F2', vendorContactsMissing ? '#B91C1C' : '#166534'),
    ...drawQrMarker(`${data.event.id}|${data.exportedAt}`, 420, 126, 6),
    ...textAt(54, 250, 'Packet contents', 15, 'F2', BRAND_HEX),
    ...textAt(54, 224, 'BEO · run sheet · call sheet · floorplan previews · vendor load-in · guest exceptions · incident report · closeout checklist', 10, 'F1', '#374151'),
    ...textAt(54, 188, 'Manager quick rule', 13, 'F2', BRAND_HEX),
    ...textAt(54, 166, 'Resolve event-day safety, no-show, load-in, ADA/fire, and critical staffing blockers before client-facing tasks.', 10, 'F1', '#374151'),
    ...textAt(420, 112, 'Quick packet reference', 8, 'F2', BRAND_HEX),
  ]);

  if (previews.length) {
    for (const preview of previews) {
      addPage([
        fillRect(0, 748, pageWidth, 44, BRAND_HEX),
        ...textAt(54, 763, 'Floorplan visual preview', 16, 'F2', '#FFFFFF'),
        ...drawLayoutPdf(preview, 54, 176, 504, 536),
        ...textAt(54, 142, 'Manager floor-walk checks', 12, 'F2', BRAND_HEX),
        ...textAt(54, 124, preview.diagnostics.warnings.length ? preview.diagnostics.warnings.join(' · ') : 'No layout warnings detected. Verify actual room setup against this preview before doors open.', 9, 'F1', '#374151'),
      ]);
    }
  }

  let content: string[] = [];
  const flush = () => {
    if (!content.length) return;
    addPage([fillRect(0, 748, pageWidth, 44, BRAND_HEX), ...textAt(54, 763, 'Operations detail', 16, 'F2', '#FFFFFF'), ...content]);
    content = [];
  };
  let y = 718;
  const ensure = (needed = 28) => { if (y - needed < 62) { flush(); y = 718; } };
  for (const section of sections) {
    ensure(42);
    content.push(...textAt(54, y, section.title, 14, 'F2', BRAND_HEX));
    y -= 22;
    for (const row of section.body) {
      for (const line of wrapText(row, 104)) {
        ensure(16);
        content.push(...textAt(66, y, line, 9, 'F1', '#1F2937'));
        y -= 14;
      }
      y -= 4;
    }
    y -= 10;
  }
  flush();

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets: number[] = [0];
  let offset = chunks[0].length;
  objects.forEach((obj, index) => {
    offsets.push(offset);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${obj}\nendobj\n`, 'utf8');
    chunks.push(chunk);
    offset += chunk.length;
  });
  const xrefOffset = offset;
  const xref = [`xref`, `0 ${objects.length + 1}`, '0000000000 65535 f ', ...offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n `)].join('\n');
  const trailer = `\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer, 'utf8'));
  return Buffer.concat(chunks);
}

export function buildOperationsPacketPdf(data: OperationsPacketData): Buffer {
  return buildDesignedPdf(data);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function u16(value: number) { const b = Buffer.alloc(2); b.writeUInt16LE(value & 0xffff, 0); return b; }
function u32(value: number) { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0, 0); return b; }

export function buildZip(files: PacketFile[], opts: { compress?: boolean } = { compress: true }): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const stamp = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const source = file.content;
    const shouldCompress = file.compress ?? opts.compress ?? true;
    const compressed = shouldCompress && source.length > 64 ? deflateRawSync(source, { level: 9 }) : source;
    const method = compressed === source ? 0 : 8;
    const crc = crc32(source);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(stamp.time), u16(stamp.date),
      u32(crc), u32(compressed.length), u32(source.length), u16(name.length), u16(0), name, compressed,
    ]);
    localParts.push(local);
    const central = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(method), u16(stamp.time), u16(stamp.date),
      u32(crc), u32(compressed.length), u32(source.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    centralParts.push(central);
    offset += local.length;
  }

  const central = Buffer.concat(centralParts);
  const local = Buffer.concat(localParts);
  const eocd = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(local.length), u16(0),
  ]);
  return Buffer.concat([local, central, eocd]);
}

function slug(value: unknown): string {
  return safe(value, 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event';
}

export function buildOperationsPacketZip(data: OperationsPacketData): Buffer {
  const markdown = buildOperationsPacketMarkdown(data);
  const manifest = buildOperationsPacketManifest(data);
  const sections = buildSections(data);
  const previews = buildLayoutPreviews(data.layouts);
  const base = `${slug(data.event.title)}-operations-packet`;
  const files: PacketFile[] = [
    { name: `${base}/00-branded-operations-packet.pdf`, content: buildOperationsPacketPdf(data), compress: true },
    { name: `${base}/00-packet-manifest.json`, content: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), compress: true },
    { name: `${base}/00-printable-operations-packet.md`, content: Buffer.from(markdown, 'utf8'), compress: true },
    ...sections.map((section, index) => ({
      name: `${base}/${String(index + 1).padStart(2, '0')}-${slug(section.title)}.txt`,
      content: Buffer.from(textSection(section.title, section.body), 'utf8'),
      compress: true,
    })),
    ...previews.map((preview, index) => ({
      name: `${base}/floorplans/${String(index + 1).padStart(2, '0')}-${slug(preview.layout.name)}-visual-preview.svg`,
      content: Buffer.from(preview.svg, 'utf8'),
      compress: true,
    })),
  ];
  return buildZip(files, { compress: true });
}
