// src/components/admin/GuestPortalManagement.tsx
// Admin tab that manages all GuestPortalConfig fields including
// schedule items and wayfinding points (B-09 fix) and the grace-period
// setting (B-06 fix). Persists via setGuestPortalConfig from guestPortal.ts.
import { useState, useCallback } from 'react';
import {
  GuestPortalConfig,
  PortalScheduleItem,
  PortalWayfindingPoint,
} from '../../types';
import {
  getGuestPortalConfig,
  setGuestPortalConfig,
} from '../../utils/guestPortal';
import { createSecretRecord as authCreateSecretRecord } from '../../utils/auth';

// ─── tiny helpers ────────────────────────────────────────────────────────────
function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_CONFIG: GuestPortalConfig = {
  eventTitle: '',
  eventStartDate: '',
  eventEndDate: '',
  isMultiDay: false,
  heroImageUrl: '',
  welcomeMessage: '',
  rsvpMessage: '',
  rsvpDeadlineDate: '',
  showMap: true,
  showSchedule: true,
  showWayfinding: false,
  showRSVP: true,
  showLodging: false,
  scheduleItems: [],
  wayfindingPoints: [],
  accessGracePeriodHours: 36,
};

// ─── sub-components ──────────────────────────────────────────────────────────
function SectionHeader({ title, emoji }: { title: string; emoji: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mt-6 mb-2 pt-4 border-t border-gray-100">
      <span>{emoji}</span> {title}
    </h3>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-indigo-600 transition-colors" />
        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-400 leading-snug">{hint}</p>}
      </div>
    </label>
  );
}

// ─── main component ──────────────────────────────────────────────────────────
export function GuestPortalManagement({
  onShowSuccess,
}: {
  onShowSuccess: (msg: string) => void;
}) {
  const [cfg, setCfg] = useState<GuestPortalConfig>(
    () => getGuestPortalConfig() ?? { ...EMPTY_CONFIG },
  );
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // ── Schedule items state ──────────────────────────────────────────────────
  const [editingItem, setEditingItem] = useState<PortalScheduleItem | null>(null);
  const [newItem, setNewItem] = useState<Partial<PortalScheduleItem>>({});
  const [showAddItem, setShowAddItem] = useState(false);

  // ── Wayfinding points state ───────────────────────────────────────────────
  const [newPoint, setNewPoint] = useState<Partial<PortalWayfindingPoint>>({});
  const [showAddPoint, setShowAddPoint] = useState(false);

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const update = useCallback(
    (patch: Partial<GuestPortalConfig>) =>
      setCfg((prev) => ({ ...prev, ...patch })),
    [],
  );

  const save = useCallback(
    (overrideCfg?: GuestPortalConfig) => {
      setGuestPortalConfig(overrideCfg ?? cfg);
      onShowSuccess('Guest Portal settings saved!');
    },
    [cfg, onShowSuccess],
  );

  // ─── Portal password ──────────────────────────────────────────────────────
  const handleSetPassword = async () => {
    if (!newPassword.trim()) return;
    setPasswordSaving(true);
    try {
      const record = await authCreateSecretRecord(newPassword.trim());
      const next: GuestPortalConfig = {
        ...cfg,
        portalPasswordHash: record.hash,
        portalPasswordSalt: record.salt,
        portalPassword: '', // clear legacy plaintext
      };
      setCfg(next);
      save(next);
      setNewPassword('');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleClearPassword = () => {
    const next: GuestPortalConfig = {
      ...cfg,
      portalPasswordHash: undefined,
      portalPasswordSalt: undefined,
      portalPassword: '',
    };
    setCfg(next);
    save(next);
  };

  // ─── Schedule items CRUD ──────────────────────────────────────────────────
  const scheduleItems = cfg.scheduleItems ?? [];

  const addScheduleItem = () => {
    if (!newItem.title?.trim() || !newItem.startTime) return;
    const item: PortalScheduleItem = {
      id: uid(),
      title: newItem.title.trim(),
      description: newItem.description?.trim() || undefined,
      location: newItem.location?.trim() || undefined,
      startTime: newItem.startTime,
      endTime: newItem.endTime || undefined,
      isHighlight: newItem.isHighlight ?? false,
      dayIndex: newItem.dayIndex ?? 0,
    };
    const next = { ...cfg, scheduleItems: [...scheduleItems, item] };
    setCfg(next);
    save(next);
    setNewItem({});
    setShowAddItem(false);
  };

  const deleteScheduleItem = (id: string) => {
    const next = {
      ...cfg,
      scheduleItems: scheduleItems.filter((i) => i.id !== id),
    };
    setCfg(next);
    save(next);
  };

  const saveEditingItem = () => {
    if (!editingItem) return;
    const next = {
      ...cfg,
      scheduleItems: scheduleItems.map((i) =>
        i.id === editingItem.id ? editingItem : i,
      ),
    };
    setCfg(next);
    save(next);
    setEditingItem(null);
  };

  // ─── Wayfinding points CRUD ───────────────────────────────────────────────
  const wayfindingPoints = cfg.wayfindingPoints ?? [];

  const addWayfindingPoint = () => {
    if (!newPoint.label?.trim()) return;
    const pt: PortalWayfindingPoint = {
      id: uid(),
      label: newPoint.label.trim(),
      description: newPoint.description?.trim() || undefined,
    };
    const next = { ...cfg, wayfindingPoints: [...wayfindingPoints, pt] };
    setCfg(next);
    save(next);
    setNewPoint({});
    setShowAddPoint(false);
  };

  const deleteWayfindingPoint = (id: string) => {
    const next = {
      ...cfg,
      wayfindingPoints: wayfindingPoints.filter((p) => p.id !== id),
    };
    setCfg(next);
    save(next);
  };

  const hasPassword = !!(cfg.portalPasswordHash || cfg.portalPassword);

  return (
    <div className="max-w-2xl mx-auto space-y-1 pb-24">
      {/* ── Hero ── */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-4 text-white mb-4">
        <h2 className="text-base font-bold">💍 Guest Portal Configuration</h2>
        <p className="text-xs text-white/80 mt-1">
          Configure what wedding guests see when they visit the Guest Portal — RSVP, schedule,
          lodging, map, and wayfinding.
        </p>
      </div>

      {/* ── Event Details ── */}
      <SectionHeader title="Event Details" emoji="📅" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Event Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            value={cfg.eventTitle}
            onChange={(e) => update({ eventTitle: e.target.value })}
            placeholder="e.g. Smith & Johnson Wedding"
          />
          <p className="text-xs text-gray-400 mt-0.5">
            Guests type this name to sign in.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            RSVP Deadline
          </label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            value={cfg.rsvpDeadlineDate ?? ''}
            onChange={(e) => update({ rsvpDeadlineDate: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Event Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            value={cfg.eventStartDate}
            onChange={(e) => update({ eventStartDate: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Event End Date
          </label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            value={cfg.eventEndDate ?? ''}
            onChange={(e) => update({ eventEndDate: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Portal Access Grace Period (hours after event end)
          </label>
          <input
            type="number"
            min={0}
            max={168}
            className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            value={cfg.accessGracePeriodHours ?? 36}
            onChange={(e) =>
              update({ accessGracePeriodHours: Number(e.target.value) })
            }
          />
          <p className="text-xs text-gray-400 mt-0.5">
            Default 36 hours so guests in Western time-zones retain access through the night of the event.
          </p>
        </div>

        <div className="sm:col-span-2">
          <ToggleRow
            label="Multi-day event"
            hint="Enables per-day tabs on the Schedule tab."
            checked={cfg.isMultiDay ?? false}
            onChange={(v) => update({ isMultiDay: v })}
          />
        </div>
      </div>

      {/* ── Welcome Content ── */}
      <SectionHeader title="Welcome Content" emoji="🌸" />

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Hero Image URL
          </label>
          <input
            type="url"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            value={cfg.heroImageUrl ?? ''}
            onChange={(e) => update({ heroImageUrl: e.target.value })}
            placeholder="https://example.com/wedding-photo.jpg"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Welcome Message
          </label>
          <textarea
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
            value={cfg.welcomeMessage ?? ''}
            onChange={(e) => update({ welcomeMessage: e.target.value })}
            placeholder="We're so excited to celebrate with you!&#10;Use the tabs below to RSVP, view the schedule, and find your room."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            RSVP Tab Message
          </label>
          <textarea
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none"
            value={cfg.rsvpMessage ?? ''}
            onChange={(e) => update({ rsvpMessage: e.target.value })}
            placeholder="Please let us know if you can make it by the deadline."
          />
        </div>
      </div>

      {/* ── Portal Features ── */}
      <SectionHeader title="Visible Tabs" emoji="🗂️" />
      <div className="space-y-3">
        <ToggleRow
          label="Show RSVP tab"
          hint="Guests can confirm attendance, meal choice, and dietary notes."
          checked={cfg.showRSVP ?? true}
          onChange={(v) => update({ showRSVP: v })}
        />
        <ToggleRow
          label="Show Schedule tab"
          hint="Publish the event timeline to guests. Add items below."
          checked={cfg.showSchedule ?? true}
          onChange={(v) => update({ showSchedule: v })}
        />
        <ToggleRow
          label="Show Map tab"
          hint="Show venue information and guest seat/room assignments."
          checked={cfg.showMap ?? true}
          onChange={(v) => update({ showMap: v })}
        />
        <ToggleRow
          label="Show Wayfinding tab"
          hint='Directions between named points. Add points below then toggle on.'
          checked={cfg.showWayfinding ?? false}
          onChange={(v) => update({ showWayfinding: v })}
        />
        <ToggleRow
          label="Show Lodging tab"
          hint="Show room assignments and lodging details."
          checked={cfg.showLodging ?? false}
          onChange={(v) => update({ showLodging: v })}
        />
      </div>

      {/* ── Portal Security ── */}
      <SectionHeader title="Portal Security" emoji="🔐" />
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
        {hasPassword ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                ✅ Password protection is active
              </p>
              <p className="text-xs text-gray-500">
                Guests must enter this password in addition to their name/email.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearPassword}
              className="text-xs text-red-600 hover:text-red-700 underline"
            >
              Remove password
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            No password set — guests only need their name or email to sign in.
          </p>
        )}

        <div className="flex gap-2">
          <input
            type="password"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            placeholder={hasPassword ? 'Enter new password to change…' : 'Set a portal password…'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={handleSetPassword}
            disabled={!newPassword.trim() || passwordSaving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40"
          >
            {passwordSaving ? 'Saving…' : hasPassword ? 'Change' : 'Set'}
          </button>
        </div>
      </div>

      {/* ── Schedule Items ── */}
      <SectionHeader title="Schedule / Timeline" emoji="📅" />
      <p className="text-xs text-gray-500 mb-2">
        Items appear on the guest-facing Schedule tab in chronological order.
      </p>

      <div className="space-y-2">
        {scheduleItems
          .slice()
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
          .map((item) =>
            editingItem?.id === item.id ? (
              <div
                key={item.id}
                className="border border-indigo-300 rounded-xl p-3 bg-indigo-50 space-y-2"
              >
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  value={editingItem.title}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, title: e.target.value })
                  }
                  placeholder="Title"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Start time</label>
                    <input
                      type="datetime-local"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs"
                      value={editingItem.startTime.slice(0, 16)}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, startTime: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">End time</label>
                    <input
                      type="datetime-local"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs"
                      value={editingItem.endTime?.slice(0, 16) ?? ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          endTime: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                </div>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  value={editingItem.location ?? ''}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, location: e.target.value })
                  }
                  placeholder="Location (optional)"
                />
                <textarea
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none"
                  value={editingItem.description ?? ''}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, description: e.target.value })
                  }
                  placeholder="Description (optional)"
                />
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingItem.isHighlight ?? false}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, isHighlight: e.target.checked })
                    }
                  />
                  Highlight item (bold, indigo color)
                </label>
                {cfg.isMultiDay && (
                  <div>
                    <label className="text-xs text-gray-500">Day (0-based)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-16 border border-gray-300 rounded px-2 py-1 text-xs ml-2"
                      value={editingItem.dayIndex ?? 0}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          dayIndex: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={saveEditingItem}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={item.id}
                className="flex items-start justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5 gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${item.isHighlight ? 'text-indigo-700' : 'text-gray-800'}`}>
                    {item.isHighlight && <span className="mr-1">⭐</span>}
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(item.startTime).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {item.endTime &&
                      ` – ${new Date(item.endTime).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`}
                    {item.location && ` · ${item.location}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingItem(item)}
                    aria-label={`Edit ${item.title}`}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteScheduleItem(item.id)}
                    aria-label={`Delete ${item.title}`}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ),
          )}
      </div>

      {showAddItem ? (
        <div className="border border-indigo-300 rounded-xl p-3 bg-indigo-50 space-y-2 mt-2">
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            value={newItem.title ?? ''}
            onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
            placeholder="Title *"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Start time *</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs"
                value={newItem.startTime ?? ''}
                onChange={(e) => setNewItem({ ...newItem, startTime: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">End time</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs"
                value={newItem.endTime ?? ''}
                onChange={(e) =>
                  setNewItem({ ...newItem, endTime: e.target.value || undefined })
                }
              />
            </div>
          </div>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            value={newItem.location ?? ''}
            onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
            placeholder="Location (optional)"
          />
          <textarea
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm resize-none"
            value={newItem.description ?? ''}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
            placeholder="Description (optional)"
          />
          <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={newItem.isHighlight ?? false}
              onChange={(e) => setNewItem({ ...newItem, isHighlight: e.target.checked })}
            />
            Highlight item
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={addScheduleItem}
              disabled={!newItem.title?.trim() || !newItem.startTime}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-40"
            >
              Add Item
            </button>
            <button
              type="button"
              onClick={() => { setShowAddItem(false); setNewItem({}); }}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddItem(true)}
          className="mt-2 w-full py-2 border-2 border-dashed border-indigo-300 rounded-xl text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          + Add Schedule Item
        </button>
      )}

      {/* ── Wayfinding Points ── */}
      <SectionHeader title="Wayfinding Destinations" emoji="🧭" />
      <p className="text-xs text-gray-500 mb-2">
        Named locations that guests can get directions to. Enable the Wayfinding tab above once
        you have at least one destination.
      </p>

      <div className="space-y-2">
        {wayfindingPoints.map((pt) => (
          <div
            key={pt.id}
            className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5 gap-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{pt.label}</p>
              {pt.description && (
                <p className="text-xs text-gray-500 truncate">{pt.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => deleteWayfindingPoint(pt.id)}
              aria-label={`Remove ${pt.label}`}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      {showAddPoint ? (
        <div className="border border-indigo-300 rounded-xl p-3 bg-indigo-50 space-y-2 mt-2">
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            value={newPoint.label ?? ''}
            onChange={(e) => setNewPoint({ ...newPoint, label: e.target.value })}
            placeholder="Destination name * (e.g. Ceremony Arch, Bar, Parking)"
            autoFocus
          />
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            value={newPoint.description ?? ''}
            onChange={(e) => setNewPoint({ ...newPoint, description: e.target.value })}
            placeholder="Short description (optional)"
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={addWayfindingPoint}
              disabled={!newPoint.label?.trim()}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg disabled:opacity-40"
            >
              Add Destination
            </button>
            <button
              type="button"
              onClick={() => { setShowAddPoint(false); setNewPoint({}); }}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddPoint(true)}
          className="mt-2 w-full py-2 border-2 border-dashed border-indigo-300 rounded-xl text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          + Add Destination
        </button>
      )}

      {/* ── Save all button ── */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-white/90 backdrop-blur-sm border-t border-gray-100 mt-6">
        <button
          type="button"
          onClick={() => save()}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 active:scale-95 transition-all"
        >
          💾 Save Guest Portal Settings
        </button>
      </div>
    </div>
  );
}
