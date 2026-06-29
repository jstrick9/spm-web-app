import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Plus,
  MapPin,
  Users,
  DollarSign,
  LayoutGrid,
  List,
  Columns3,
  Download,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { NAVY, GOLD, IVORY, ROSE, FONT_DISPLAY, cardStyle } from '../constants/design';
import {
  PageHeader,
  BtnPrimary,
  BtnSecondary,
  SearchBar,
  FilterPills,
  StatusBadge,
  AvatarInitials,
  ProgressRing,
  EmptyState,
  formatCurrency,
} from '../components/ui/PremiumUI';

type EventStatus = 'all' | 'inquiry' | 'tour' | 'pending' | 'confirmed' | 'completed';
type ViewMode = 'grid' | 'list' | 'pipeline';

interface EventItem {
  id: string;
  couple: string;
  date: string;
  daysUntil: number;
  guests: number;
  package: string;
  space: string;
  revenue: number;
  status: 'inquiry' | 'tour' | 'pending' | 'confirmed' | 'completed';
  coordinator: string;
  progress: number;
  checklist: { done: number; total: number };
}

const EVENTS: EventItem[] = [
  {
    id: '1', couple: 'Emily & James Whitmore', date: 'Jun 28, 2026', daysUntil: 1,
    guests: 180, package: 'Grand Estate', space: 'Grand Ballroom', revenue: 48500,
    status: 'confirmed', coordinator: 'Sarah M.', progress: 92,
    checklist: { done: 23, total: 25 },
  },
  {
    id: '2', couple: 'Sophia & Michael Chen', date: 'Jul 12, 2026', daysUntil: 15,
    guests: 120, package: 'Garden Pavilion', space: 'Garden Pavilion', revenue: 32000,
    status: 'pending', coordinator: 'David K.', progress: 68,
    checklist: { done: 17, total: 25 },
  },
  {
    id: '3', couple: 'Olivia & Daniel Brooks', date: 'Jul 19, 2026', daysUntil: 22,
    guests: 95, package: 'Intimate Courtyard', space: 'Courtyard', revenue: 22800,
    status: 'tour', coordinator: 'Sarah M.', progress: 15,
    checklist: { done: 4, total: 25 },
  },
  {
    id: '4', couple: 'Isabella & Marcus Rivera', date: 'Aug 3, 2026', daysUntil: 37,
    guests: 210, package: 'Grand Estate', space: 'Grand Ballroom', revenue: 52000,
    status: 'confirmed', coordinator: 'David K.', progress: 78,
    checklist: { done: 19, total: 25 },
  },
  {
    id: '5', couple: 'Grace & Thomas Hartley', date: 'Aug 17, 2026', daysUntil: 51,
    guests: 0, package: 'TBD', space: '—', revenue: 0,
    status: 'inquiry', coordinator: 'Sarah M.', progress: 5,
    checklist: { done: 1, total: 25 },
  },
  {
    id: '6', couple: 'Amelia & David Park', date: 'Sep 5, 2026', daysUntil: 70,
    guests: 150, package: 'Garden Pavilion', space: 'Garden Pavilion', revenue: 38000,
    status: 'confirmed', coordinator: 'David K.', progress: 55,
    checklist: { done: 14, total: 25 },
  },
  {
    id: '7', couple: 'Rachel & Nathan Cole', date: 'May 10, 2026', daysUntil: -48,
    guests: 140, package: 'Grand Estate', space: 'Grand Ballroom', revenue: 45000,
    status: 'completed', coordinator: 'Sarah M.', progress: 100,
    checklist: { done: 25, total: 25 },
  },
];

const PIPELINE_STAGES: { id: EventStatus; label: string }[] = [
  { id: 'inquiry', label: 'Inquiry' },
  { id: 'tour', label: 'Tour' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
];

interface EventsProps {
  initialSearch?: string;
}

export const Events: React.FC<EventsProps> = ({ initialSearch = '' }) => {
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<EventStatus>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const filtered = useMemo(() => {
    return EVENTS.filter((e) => {
      const matchSearch =
        !search ||
        e.couple.toLowerCase().includes(search.toLowerCase()) ||
        e.package.toLowerCase().includes(search.toLowerCase()) ||
        e.space.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<EventStatus, number> = {
      all: EVENTS.length,
      inquiry: 0, tour: 0, pending: 0, confirmed: 0, completed: 0,
    };
    EVENTS.forEach((e) => { c[e.status]++; });
    return c;
  }, []);

  const filterOptions: { id: EventStatus; label: string; count: number }[] = [
    { id: 'all', label: 'All Events', count: counts.all },
    { id: 'inquiry', label: 'Inquiries', count: counts.inquiry },
    { id: 'tour', label: 'Tours', count: counts.tour },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'confirmed', label: 'Confirmed', count: counts.confirmed },
    { id: 'completed', label: 'Completed', count: counts.completed },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Event Management"
        title="Events"
        subtitle="Manage bookings, tours, inquiries, and wedding timelines across all venue spaces."
        action={
          <>
            <BtnSecondary icon={Download}>Export</BtnSecondary>
            <BtnPrimary icon={Plus}>New Event</BtnPrimary>
          </>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by couple, package, or space…"
        />
        <div className="flex items-center gap-1 p-1 rounded-lg shrink-0" style={{ backgroundColor: IVORY, border: `1px solid ${GOLD}25` }}>
          {([
            { id: 'grid' as ViewMode, icon: LayoutGrid, label: 'Grid' },
            { id: 'list' as ViewMode, icon: List, label: 'List' },
            { id: 'pipeline' as ViewMode, icon: Columns3, label: 'Pipeline' },
          ]).map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={
                viewMode === v.id
                  ? { backgroundColor: NAVY, color: IVORY }
                  : { color: `${NAVY}70` }
              }
              aria-label={`${v.label} view`}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      <FilterPills options={filterOptions} value={statusFilter} onChange={setStatusFilter} />

      {filtered.length === 0 ? (
        <div className="rounded-xl" style={cardStyle}>
          <EmptyState
            icon={CalendarDays}
            title="No events found"
            description="Try adjusting your search or filters, or create a new event to get started."
            action={<BtnPrimary icon={Plus}>Create Event</BtnPrimary>}
          />
        </div>
      ) : viewMode === 'pipeline' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageEvents = filtered.filter((e) => e.status === stage.id);
            return (
              <div key={stage.id} className="rounded-xl p-4 min-h-[200px]" style={cardStyle}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold" style={{ color: NAVY }}>{stage.label}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${NAVY}08`, color: `${NAVY}60` }}>
                    {stageEvents.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {stageEvents.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg cursor-pointer transition-shadow hover:shadow-sm"
                      style={{ backgroundColor: 'white', border: `1px solid ${GOLD}20` }}
                    >
                      <p className="text-sm font-medium truncate" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
                        {event.couple}
                      </p>
                      <p className="text-xs mt-1" style={{ color: `${NAVY}60` }}>{event.date}</p>
                      {event.revenue > 0 && (
                        <p className="text-xs font-medium mt-1" style={{ color: GOLD }}>
                          {formatCurrency(event.revenue)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === 'list' ? (
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: `${GOLD}08` }}>
                {['Couple', 'Date', 'Space', 'Guests', 'Revenue', 'Progress', 'Status'].map((col) => (
                  <th key={col} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: `${NAVY}70` }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((event, i) => (
                <tr
                  key={event.id}
                  className="transition-colors hover:bg-white/60 cursor-pointer"
                  style={{ borderTop: i > 0 ? `1px solid ${GOLD}12` : undefined }}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <AvatarInitials name={event.couple} size="sm" />
                      <span className="font-medium" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
                        {event.couple}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4" style={{ color: `${NAVY}80` }}>{event.date}</td>
                  <td className="px-5 py-4" style={{ color: `${NAVY}80` }}>{event.space}</td>
                  <td className="px-5 py-4" style={{ color: `${NAVY}80` }}>
                    {event.guests > 0 ? event.guests : '—'}
                  </td>
                  <td className="px-5 py-4 font-medium" style={{ color: NAVY }}>
                    {formatCurrency(event.revenue)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <ProgressRing value={event.progress} size={32} />
                      <span className="text-xs" style={{ color: `${NAVY}60` }}>
                        {event.checklist.done}/{event.checklist.total}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge variant={event.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((event) => (
            <div
              key={event.id}
              className="rounded-xl p-5 transition-all hover:shadow-lg cursor-pointer group"
              style={cardStyle}
            >
              <div className="flex items-start justify-between mb-4">
                <AvatarInitials name={event.couple} size="lg" />
                <StatusBadge variant={event.status} />
              </div>

              <h3
                className="text-lg font-semibold group-hover:underline"
                style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
              >
                {event.couple}
              </h3>

              <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: `${NAVY}70` }}>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" style={{ color: GOLD }} />
                  {event.date}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" style={{ color: GOLD }} />
                  {event.space}
                </span>
                {event.guests > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" style={{ color: GOLD }} />
                    {event.guests} guests
                  </span>
                )}
              </div>

              {event.daysUntil > 0 && (
                <div
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: `${ROSE}20`, color: '#9A6B55' }}
                >
                  {event.daysUntil} days until event
                </div>
              )}

              <div className="mt-4 pt-4 border-t flex items-center justify-between" style={{ borderColor: `${GOLD}15` }}>
                <div className="flex items-center gap-3">
                  <ProgressRing value={event.progress} />
                  <div>
                    <p className="text-xs" style={{ color: `${NAVY}60` }}>Planning progress</p>
                    <p className="text-sm font-semibold" style={{ color: NAVY }}>
                      {event.checklist.done}/{event.checklist.total} tasks
                    </p>
                  </div>
                </div>
                {event.revenue > 0 && (
                  <div className="text-right">
                    <p className="text-xs" style={{ color: `${NAVY}60` }}>Revenue</p>
                    <p className="text-sm font-bold flex items-center gap-0.5" style={{ color: GOLD }}>
                      <DollarSign className="h-3.5 w-3.5" />
                      {formatCurrency(event.revenue).replace('$', '')}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <BtnPrimary className="flex-1 justify-center text-xs py-2">
                  View Details
                </BtnPrimary>
                <BtnSecondary className="px-3 py-2">
                  <ChevronRight className="h-4 w-4" />
                </BtnSecondary>
              </div>

              <p className="text-[10px] mt-3 flex items-center gap-1" style={{ color: `${NAVY}40` }}>
                <Clock className="h-3 w-3" />
                Coordinator: {event.coordinator}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
