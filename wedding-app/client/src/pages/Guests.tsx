import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Download,
  Upload,
  Mail,
  Utensils,
  Accessibility,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { NAVY, GOLD, IVORY, FONT_DISPLAY, cardStyle } from '../constants/design';
import {
  PageHeader,
  MetricCard,
  BtnPrimary,
  BtnSecondary,
  SearchBar,
  FilterPills,
  StatusBadge,
  AvatarInitials,
  TagChip,
  EmptyState,
} from '../components/ui/PremiumUI';

type RsvpFilter = 'all' | 'confirmed' | 'pending' | 'declined';

interface Guest {
  id: string;
  name: string;
  email: string;
  event: string;
  status: 'confirmed' | 'pending' | 'declined';
  table: string | null;
  meal: string | null;
  tags: string[];
}

const GUESTS: Guest[] = [
  { id: '1', name: 'Margaret Whitmore', email: 'm.whitmore@email.com', event: 'Whitmore Wedding', status: 'confirmed', table: 'Table 1', meal: 'Beef', tags: ['VIP'] },
  { id: '2', name: 'Robert Whitmore', email: 'r.whitmore@email.com', event: 'Whitmore Wedding', status: 'confirmed', table: 'Table 1', meal: 'Beef', tags: [] },
  { id: '3', name: 'Jennifer Chen', email: 'j.chen@email.com', event: 'Chen Wedding', status: 'pending', table: null, meal: null, tags: [] },
  { id: '4', name: 'Michael Sullivan', email: 'm.sullivan@email.com', event: 'Whitmore Wedding', status: 'confirmed', table: 'Table 3', meal: 'Chicken', tags: ['Vegetarian option'] },
  { id: '5', name: 'Patricia Adams', email: 'p.adams@email.com', event: 'Whitmore Wedding', status: 'declined', table: null, meal: null, tags: [] },
  { id: '6', name: 'David Kim', email: 'd.kim@email.com', event: 'Chen Wedding', status: 'confirmed', table: 'Table 2', meal: 'Fish', tags: ['Gluten-free'] },
  { id: '7', name: 'Sarah Lopez', email: 's.lopez@email.com', event: 'Rivera Wedding', status: 'confirmed', table: 'Table 5', meal: 'Vegetarian', tags: ['Vegan', 'Accessibility'] },
  { id: '8', name: 'Thomas Hartley', email: 't.hartley@email.com', event: 'Hartley Inquiry', status: 'pending', table: null, meal: null, tags: [] },
  { id: '9', name: 'Emma Wilson', email: 'e.wilson@email.com', event: 'Whitmore Wedding', status: 'confirmed', table: 'Table 4', meal: 'Chicken', tags: [] },
  { id: '10', name: 'James Park', email: 'j.park@email.com', event: 'Park Wedding', status: 'pending', table: null, meal: null, tags: [] },
];

interface GuestsProps {
  initialSearch?: string;
}

export const Guests: React.FC<GuestsProps> = ({ initialSearch = '' }) => {
  const [search, setSearch] = useState(initialSearch);
  const [rsvpFilter, setRsvpFilter] = useState<RsvpFilter>('all');

  const filtered = useMemo(() => {
    return GUESTS.filter((g) => {
      const matchSearch =
        !search ||
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.email.toLowerCase().includes(search.toLowerCase()) ||
        g.event.toLowerCase().includes(search.toLowerCase());
      const matchRsvp = rsvpFilter === 'all' || g.status === rsvpFilter;
      return matchSearch && matchRsvp;
    });
  }, [search, rsvpFilter]);

  const stats = useMemo(() => {
    const confirmed = GUESTS.filter((g) => g.status === 'confirmed').length;
    const pending = GUESTS.filter((g) => g.status === 'pending').length;
    const declined = GUESTS.filter((g) => g.status === 'declined').length;
    const dietary = GUESTS.filter((g) => g.tags.some((t) => /vegan|vegetarian|gluten/i.test(t))).length;
    return { total: GUESTS.length, confirmed, pending, declined, dietary };
  }, []);

  const filterOptions: { id: RsvpFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All Guests', count: stats.total },
    { id: 'confirmed', label: 'Confirmed', count: stats.confirmed },
    { id: 'pending', label: 'Pending', count: stats.pending },
    { id: 'declined', label: 'Declined', count: stats.declined },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Guest Management"
        title="Guest List"
        subtitle="Track RSVPs, dietary needs, accessibility requests, and table assignments across all events."
        action={
          <>
            <BtnSecondary icon={Upload}>Import</BtnSecondary>
            <BtnSecondary icon={Download}>Export</BtnSecondary>
            <BtnPrimary icon={Plus}>Add Guest</BtnPrimary>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Guests" value={String(stats.total)} icon={Users} trend={`Across ${new Set(GUESTS.map((g) => g.event)).size} events`} />
        <MetricCard label="Confirmed" value={String(stats.confirmed)} icon={CheckCircle2} trend={`${Math.round((stats.confirmed / stats.total) * 100)}% response rate`} />
        <MetricCard label="Awaiting RSVP" value={String(stats.pending)} icon={Clock} trend="Send reminders" />
        <MetricCard label="Special Dietary" value={String(stats.dietary)} icon={Utensils} trend="Needs attention" />
      </div>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, email, or event…"
      />

      <FilterPills options={filterOptions} value={rsvpFilter} onChange={setRsvpFilter} />

      {filtered.length === 0 ? (
        <div className="rounded-xl" style={cardStyle}>
          <EmptyState
            icon={Users}
            title="No guests found"
            description="Adjust your search or filters, or add guests manually or via import."
            action={<BtnPrimary icon={Plus}>Add Guest</BtnPrimary>}
          />
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: `${GOLD}08` }}>
                  {['Guest', 'Event', 'RSVP', 'Table', 'Meal', 'Special Needs', 'Actions'].map((col) => (
                    <th key={col} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: `${NAVY}70` }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((guest, i) => (
                  <tr
                    key={guest.id}
                    className="transition-colors hover:bg-white/60"
                    style={{ borderTop: i > 0 ? `1px solid ${GOLD}12` : undefined }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <AvatarInitials name={guest.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium truncate" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
                            {guest.name}
                          </p>
                          <p className="text-xs truncate flex items-center gap-1" style={{ color: `${NAVY}50` }}>
                            <Mail className="h-3 w-3 shrink-0" />
                            {guest.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4" style={{ color: `${NAVY}80` }}>{guest.event}</td>
                    <td className="px-5 py-4">
                      <StatusBadge variant={guest.status} />
                    </td>
                    <td className="px-5 py-4" style={{ color: `${NAVY}80` }}>
                      {guest.table ?? <span style={{ color: `${NAVY}40` }}>Unassigned</span>}
                    </td>
                    <td className="px-5 py-4" style={{ color: `${NAVY}80` }}>
                      {guest.meal ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {guest.tags.length === 0 ? (
                          <span style={{ color: `${NAVY}40` }}>—</span>
                        ) : (
                          guest.tags.map((tag) => (
                            <TagChip
                              key={tag}
                              label={tag}
                              color={
                                /vegan|vegetarian|gluten/i.test(tag) ? 'sage' :
                                /accessibility/i.test(tag) ? 'navy' :
                                /vip/i.test(tag) ? 'gold' : 'rose'
                              }
                            />
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button className="text-sm font-medium hover:underline" style={{ color: GOLD }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          <div
            className="px-5 py-3 border-t flex flex-wrap items-center gap-4 text-xs"
            style={{ borderColor: `${GOLD}15`, backgroundColor: `${GOLD}04` }}
          >
            <span className="flex items-center gap-1.5" style={{ color: `${NAVY}70` }}>
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: '#065F46' }} />
              {stats.confirmed} confirmed
            </span>
            <span className="flex items-center gap-1.5" style={{ color: `${NAVY}70` }}>
              <Clock className="h-3.5 w-3.5" style={{ color: GOLD }} />
              {stats.pending} pending
            </span>
            <span className="flex items-center gap-1.5" style={{ color: `${NAVY}70` }}>
              <XCircle className="h-3.5 w-3.5" style={{ color: '#991B1B' }} />
              {stats.declined} declined
            </span>
            <span className="flex items-center gap-1.5" style={{ color: `${NAVY}70` }}>
              <Utensils className="h-3.5 w-3.5" style={{ color: GOLD }} />
              {stats.dietary} dietary needs
            </span>
            <span className="flex items-center gap-1.5" style={{ color: `${NAVY}70` }}>
              <Accessibility className="h-3.5 w-3.5" style={{ color: NAVY }} />
              {GUESTS.filter((g) => g.tags.some((t) => /accessibility/i.test(t))).length} accessibility
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
