import React, { useState } from 'react';
import {
  Building2,
  Package,
  Users,
  Bell,
  Palette,
  Save,
  MapPin,
  Phone,
  Mail,
  Globe,
  Shield,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { NAVY, GOLD, IVORY, ROSE, FONT_DISPLAY, cardStyle } from '../constants/design';
import {
  PageHeader,
  BtnPrimary,
  BtnSecondary,
  BtnGhost,
  PremiumCard,
  TagChip,
  StatusBadge,
} from '../components/ui/PremiumUI';
import { useTheme } from '../context/ThemeContext';
import type { ThemeName } from '../context/themeDefinitions';
import { themePresets } from '../context/themeDefinitions';

type SettingsTab = 'venue' | 'packages' | 'team' | 'notifications' | 'appearance';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'venue', label: 'Venue Profile', icon: Building2 },
  { id: 'packages', label: 'Packages', icon: Package },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

const PACKAGES = [
  { name: 'Grand Estate', price: 52000, guests: '150–250', spaces: ['Grand Ballroom', 'Courtyard'], popular: true },
  { name: 'Garden Pavilion', price: 38000, guests: '80–140', spaces: ['Garden Pavilion'], popular: false },
  { name: 'Intimate Courtyard', price: 22800, guests: '40–80', spaces: ['Courtyard'], popular: false },
];

const TEAM = [
  { name: 'John Doe', role: 'Venue Manager', email: 'john@sevenpathsmanor.com', active: true },
  { name: 'Sarah Mitchell', role: 'Event Coordinator', email: 'sarah@sevenpathsmanor.com', active: true },
  { name: 'David Kim', role: 'Event Coordinator', email: 'david@sevenpathsmanor.com', active: true },
  { name: 'Lisa Park', role: 'Catering Lead', email: 'lisa@sevenpathsmanor.com', active: false },
];

const NOTIFICATION_PREFS = [
  { id: 'inquiries', label: 'New inquiries', description: 'When a couple submits a venue inquiry', enabled: true },
  { id: 'rsvp', label: 'RSVP updates', description: 'When guests confirm or decline', enabled: true },
  { id: 'tours', label: 'Tour reminders', description: '1 hour before scheduled tours', enabled: true },
  { id: 'contracts', label: 'Contract events', description: 'Signed contracts and payments', enabled: true },
  { id: 'weekly', label: 'Weekly digest', description: 'Summary of venue activity every Monday', enabled: false },
];

const THEME_OPTIONS: { id: ThemeName; label: string }[] = [
  { id: 'seven-paths-manor', label: 'Seven Paths Manor' },
  { id: 'warm-romantic', label: 'Warm & Romantic' },
  { id: 'modern-minimalist', label: 'Modern Minimalist' },
  { id: 'bold-editorial', label: 'Bold Editorial' },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} aria-label={enabled ? 'Disable' : 'Enable'}>
      {enabled ? (
        <ToggleRight className="h-6 w-6" style={{ color: GOLD }} />
      ) : (
        <ToggleLeft className="h-6 w-6" style={{ color: `${NAVY}30` }} />
      )}
    </button>
  );
}

function FormField({
  label,
  value,
  icon: Icon,
  type = 'text',
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: `${NAVY}60` }}>
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: `${NAVY}40` }} />
        )}
        <input
          type={type}
          value={value}
          readOnly
          className={`w-full py-2.5 rounded-lg text-sm ${Icon ? 'pl-10 pr-4' : 'px-4'}`}
          style={{ backgroundColor: 'white', border: `1px solid ${GOLD}25`, color: NAVY }}
        />
      </div>
    </div>
  );
}

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('venue');
  const [notifPrefs, setNotifPrefs] = useState(NOTIFICATION_PREFS);
  const { currentTheme, setTheme } = useTheme();

  const toggleNotif = (id: string) => {
    setNotifPrefs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        subtitle="Manage your venue profile, wedding packages, team members, and platform preferences."
        action={
          <BtnPrimary icon={Save}>Save Changes</BtnPrimary>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tab nav */}
        <nav className="lg:col-span-1 space-y-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all"
                style={
                  active
                    ? { backgroundColor: NAVY, color: IVORY }
                    : { backgroundColor: IVORY, color: NAVY, border: `1px solid ${GOLD}20` }
                }
              >
                <tab.icon className="h-4 w-4 shrink-0" style={{ color: active ? GOLD : `${NAVY}50` }} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'venue' && (
            <PremiumCard>
              <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
                Venue Profile
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField label="Venue Name" value="Seven Paths Manor" icon={Building2} />
                <FormField label="Address" value="1842 Estate Lane, Charlottesville, VA 22901" icon={MapPin} />
                <FormField label="Phone" value="(434) 555-0182" icon={Phone} type="tel" />
                <FormField label="Email" value="events@sevenpathsmanor.com" icon={Mail} type="email" />
                <FormField label="Website" value="sevenpathsmanor.com" icon={Globe} />
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: `${NAVY}60` }}>
                    Spaces
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['Grand Ballroom', 'Garden Pavilion', 'Intimate Courtyard', 'Bridal Suite'].map((s) => (
                      <TagChip key={s} label={s} color="gold" />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 p-4 rounded-lg flex items-start gap-3" style={{ backgroundColor: `${GOLD}08`, border: `1px solid ${GOLD}20` }}>
                <Shield className="h-5 w-5 shrink-0 mt-0.5" style={{ color: GOLD }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: NAVY }}>Venue capacity overview</p>
                  <p className="text-xs mt-1" style={{ color: `${NAVY}70` }}>
                    Grand Ballroom: 220 · Garden Pavilion: 140 · Courtyard: 80 · Total annual events: 48
                  </p>
                </div>
              </div>
            </PremiumCard>
          )}

          {activeTab === 'packages' && (
            <div className="space-y-4">
              {PACKAGES.map((pkg) => (
                <div key={pkg.name} className="rounded-xl p-5" style={cardStyle}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
                          {pkg.name}
                        </h3>
                        {pkg.popular && <TagChip label="Most Popular" color="gold" />}
                      </div>
                      <p className="text-sm mt-1" style={{ color: `${NAVY}70` }}>
                        {pkg.guests} guests · {pkg.spaces.join(', ')}
                      </p>
                    </div>
                    <p className="text-xl font-bold" style={{ fontFamily: FONT_DISPLAY, color: GOLD }}>
                      ${pkg.price.toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <BtnSecondary>Edit Package</BtnSecondary>
                    <BtnGhost>View inclusions</BtnGhost>
                  </div>
                </div>
              ))}
              <BtnSecondary icon={Package}>Add Package</BtnSecondary>
            </div>
          )}

          {activeTab === 'team' && (
            <PremiumCard padding={false}>
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: `${GOLD}15` }}>
                <h2 className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
                  Team Members
                </h2>
                <BtnSecondary icon={Users}>Invite</BtnSecondary>
              </div>
              <div className="divide-y" style={{ borderColor: `${GOLD}10` }}>
                {TEAM.map((member) => (
                  <div key={member.email} className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: `${GOLD}20`, color: '#8B6914' }}
                      >
                        {member.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: NAVY }}>{member.name}</p>
                        <p className="text-xs" style={{ color: `${NAVY}60` }}>{member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs hidden sm:block" style={{ color: `${NAVY}50` }}>{member.email}</span>
                      <StatusBadge variant={member.active ? 'confirmed' : 'draft'} label={member.active ? 'Active' : 'Inactive'} />
                    </div>
                  </div>
                ))}
              </div>
            </PremiumCard>
          )}

          {activeTab === 'notifications' && (
            <PremiumCard padding={false}>
              <div className="px-6 py-4 border-b" style={{ borderColor: `${GOLD}15` }}>
                <h2 className="text-lg font-semibold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
                  Notification Preferences
                </h2>
                <p className="text-sm mt-0.5" style={{ color: `${NAVY}70` }}>
                  Choose what updates you receive and how
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: `${GOLD}10` }}>
                {notifPrefs.map((pref) => (
                  <div key={pref.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-medium" style={{ color: NAVY }}>{pref.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: `${NAVY}60` }}>{pref.description}</p>
                    </div>
                    <Toggle enabled={pref.enabled} onChange={() => toggleNotif(pref.id)} />
                  </div>
                ))}
              </div>
            </PremiumCard>
          )}

          {activeTab === 'appearance' && (
            <PremiumCard>
              <h2 className="text-xl font-semibold mb-2" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
                Theme & Appearance
              </h2>
              <p className="text-sm mb-6" style={{ color: `${NAVY}70` }}>
                Select a visual theme that reflects your venue's personality
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {THEME_OPTIONS.map((theme) => {
                  const active = currentTheme === theme.id;
                  const colors = themePresets[theme.id];
                  return (
                    <button
                      key={theme.id}
                      onClick={() => setTheme(theme.id)}
                      className="p-4 rounded-xl text-left transition-all"
                      style={{
                        backgroundColor: active ? `${GOLD}10` : 'white',
                        border: active ? `2px solid ${GOLD}` : `1px solid ${GOLD}25`,
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-lg"
                          style={{
                            background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
                          }}
                        />
                        <div>
                          <p className="text-sm font-semibold" style={{ color: NAVY }}>{theme.label}</p>
                          {active && <TagChip label="Active" color="gold" />}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[colors.primary, colors.accent, colors.background, colors.secondary].map((c, i) => (
                          <div key={i} className="w-6 h-6 rounded" style={{ backgroundColor: c, border: `1px solid ${NAVY}10` }} />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </PremiumCard>
          )}
        </div>
      </div>
    </div>
  );
};