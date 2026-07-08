import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarDays,
  DollarSign,
  DoorOpen,
  Mail,
  Plus,
  Users,
  PenTool,
  ArrowUpRight,
  Clock,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import {
  BLACK,
  PLUM,
  OFFWHITE,
  GRAY_DARK,
  GRAY_MID,
  GRAY_LIGHT,
  WHITE,
  CHARCOAL,
  PLUM_MID,
  PLUM_BORDER,
  FONT_HEADING,
  cardStyle,
  cardStyleDark,
} from '../constants/design';
import type { Page } from '../types/navigation';
import {
  MetricCard,
  StatusBadge,
  BtnPrimary,
  BtnSecondary,
  formatCurrency,
} from '../components/ui/PremiumUI';
import { RecentBookingsTable } from '../components/RecentBookingsTable';

interface DashboardProps {
  onNavigate?: (page: Page) => void;
}

interface Booking {
  id: string;
  couple: string;
  date: string;
  guests: number;
  package: string;
  revenue: number;
  status: 'confirmed' | 'pending' | 'tour' | 'inquiry';
}

const stats = [
  {
    label: "Today's Events",
    value: '3',
    subtext: '2 ceremonies · 1 reception',
    icon: CalendarDays,
    trend: '+1 from yesterday',
  },
  {
    label: 'Monthly Revenue',
    value: '$284,500',
    subtext: 'June 2026',
    icon: DollarSign,
    trend: '+12.4% vs last month',
  },
  {
    label: 'Upcoming Tours',
    value: '7',
    subtext: 'Next 14 days',
    icon: DoorOpen,
    trend: '3 this week',
  },
  {
    label: 'Open Inquiries',
    value: '12',
    subtext: 'Awaiting response',
    icon: Mail,
    trend: '4 high priority',
  },
];

const revenueData = [
  { month: 'Jan', revenue: 142000 },
  { month: 'Feb', revenue: 168000 },
  { month: 'Mar', revenue: 195000 },
  { month: 'Apr', revenue: 224000 },
  { month: 'May', revenue: 258000 },
  { month: 'Jun', revenue: 284500 },
];

const todaySchedule = [
  { time: '10:00 AM', title: 'Whitmore Ceremony', location: 'Grand Ballroom', type: 'ceremony' },
  { time: '12:30 PM', title: 'Chen Family Tour', location: 'Garden Pavilion', type: 'tour' },
  { time: '2:00 PM', title: 'Whitmore Reception', location: 'Grand Ballroom', type: 'reception' },
  { time: '4:30 PM', title: 'Brooks Consultation', location: 'Courtyard', type: 'meeting' },
];

const upcomingTours = [
  { couple: 'Sophia & Michael Chen', date: 'Today, 12:30 PM', space: 'Garden Pavilion' },
  { couple: 'Olivia & Daniel Brooks', date: 'Mon, Jul 19', space: 'Intimate Courtyard' },
  { couple: 'Amelia & David Park', date: 'Wed, Jul 21', space: 'Grand Estate' },
];

const activityFeed = [
  { text: 'Grace Hartley submitted a new inquiry', time: '12 min ago', type: 'inquiry' },
  { text: 'Margaret Whitmore RSVP confirmed', time: '1 hr ago', type: 'rsvp' },
  { text: 'Rivera contract signed & uploaded', time: '3 hrs ago', type: 'contract' },
  { text: 'Floor plan updated for Whitmore wedding', time: 'Yesterday', type: 'floorplan' },
];

const recentBookings: Booking[] = [
  { id: '1', couple: 'Emily & James Whitmore', date: 'Jun 28, 2026', guests: 180, package: 'Grand Estate', revenue: 48500, status: 'confirmed' },
  { id: '2', couple: 'Sophia & Michael Chen', date: 'Jul 12, 2026', guests: 120, package: 'Garden Pavilion', revenue: 32000, status: 'pending' },
  { id: '3', couple: 'Olivia & Daniel Brooks', date: 'Jul 19, 2026', guests: 95, package: 'Intimate Courtyard', revenue: 22800, status: 'tour' },
  { id: '4', couple: 'Isabella & Marcus Rivera', date: 'Aug 3, 2026', guests: 210, package: 'Grand Estate', revenue: 52000, status: 'confirmed' },
  { id: '5', couple: 'Grace & Thomas Hartley', date: 'Aug 17, 2026', guests: 0, package: 'TBD', revenue: 0, status: 'inquiry' },
];

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-lg text-sm"
      style={{ backgroundColor: CHARCOAL, color: WHITE, border: `1px solid ${PLUM_BORDER}` }}
    >
      <p className="font-medium" style={{ fontFamily: FONT_HEADING }}>{label}</p>
      <p style={{ color: PLUM_MID }}>{formatCurrency(payload[0].value)}</p>
    </div>
  );
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const quickActions = [
    { label: 'New Event', icon: Plus, page: 'events' as Page, primary: true },
    { label: 'Manage Guests', icon: Users, page: 'guests' as Page },
    { label: 'Floor Plan', icon: PenTool, page: 'floorplan' as Page },
    { label: 'View Inquiries', icon: Mail, page: 'events' as Page },
  ];

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide uppercase"
            style={{ color: PLUM_MID }}>
            Venue Overview
          </p>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mt-1"
            style={{ fontFamily: FONT_HEADING, color: BLACK }}>
            Good morning, John
          </h1>
          <p className="text-sm mt-2" style={{ color: GRAY_MID }}>
            You have 3 events today and 7 tours this week.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BtnSecondary icon={CalendarDays} onClick={() => onNavigate?.('events')}>
            View calendar
          </BtnSecondary>
          <BtnPrimary icon={Plus} onClick={() => onNavigate?.('events')}>
            New event
          </BtnPrimary>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <MetricCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Schedule + Tours + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Today's Schedule */}
        <div className="lg:col-span-2 rounded-xl p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-semibold"
                style={{ fontFamily: FONT_HEADING, color: BLACK }}>
                Today's Schedule
              </h2>
              <p className="text-sm flex items-center gap-1.5 mt-0.5"
                style={{ color: GRAY_MID }}>
                <Clock className="h-3.5 w-3.5" style={{ color: PLUM }} />
                {today}
              </p>
            </div>
            <StatusBadge variant="upcoming" label="4 events" />
          </div>
          <div className="space-y-3">
            {todaySchedule.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-3.5 rounded-lg transition-colors hover:bg-white/60"
                style={{ border: `1px solid ${PLUM_BORDER}` }}
              >
                <div className="text-sm font-semibold tabular-nums shrink-0 w-20"
                  style={{ color: PLUM }}>
                  {item.time}
                </div>
                <div className="w-1 h-10 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      item.type === 'ceremony' ? PLUM :
                      item.type === 'tour' ? PLUM_MID :
                      item.type === 'reception' ? BLACK : GRAY_LIGHT,
                  }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium"
                    style={{ fontFamily: FONT_HEADING, color: BLACK }}>
                    {item.title}
                  </p>
                  <p className="text-xs flex items-center gap-1 mt-0.5"
                    style={{ color: GRAY_MID }}>
                    <MapPin className="h-3 w-3" />
                    {item.location}
                  </p>
                </div>
                <StatusBadge
                  variant={item.type === 'tour' ? 'tour' : 'confirmed'}
                  label={item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">

          {/* Upcoming Tours */}
          <div className="rounded-xl p-5" style={cardStyleDark}>
            <div className="flex items-center gap-2 mb-4">
              <DoorOpen className="h-4 w-4" style={{ color: PLUM_MID }} />
              <h3 className="font-semibold"
                style={{ fontFamily: FONT_HEADING, color: WHITE }}>
                Upcoming Tours
              </h3>
            </div>
            <div className="space-y-3">
              {upcomingTours.map((tour, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${WHITE}06`, border: `1px solid ${PLUM_BORDER}` }}
                >
                  <p className="text-sm font-medium" style={{ color: WHITE }}>
                    {tour.couple}
                  </p>
                  <p className="text-xs mt-1" style={{ color: `${WHITE}60` }}>
                    {tour.date}
                  </p>
                  <p className="text-xs flex items-center gap-1 mt-0.5"
                    style={{ color: PLUM_MID }}>
                    <MapPin className="h-3 w-3" />
                    {tour.space}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => onNavigate?.('events')}
              className="w-full mt-4 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ color: PLUM_MID, border: `1px solid ${PLUM_BORDER}` }}
            >
              View all tours →
            </button>
          </div>

          {/* Activity Feed */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4" style={{ color: PLUM }} />
              <h3 className="font-semibold"
                style={{ fontFamily: FONT_HEADING, color: BLACK }}>
                Recent Activity
              </h3>
            </div>
            <div className="space-y-3">
              {activityFeed.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: PLUM }}
                  />
                  <div>
                    <p className="text-xs leading-relaxed"
                      style={{ color: GRAY_DARK }}>
                      {item.text}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: GRAY_MID }}>
                      {item.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <RecentBookingsTable
        bookings={recentBookings}
        onNavigate={onNavigate}
      />

      {/* Revenue Chart */}
      <div className="rounded-xl p-6" style={cardStyle}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold"
              style={{ fontFamily: FONT_HEADING, color: BLACK }}>
              Revenue Overview
            </h2>
            <p className="text-sm mt-0.5" style={{ color: GRAY_MID }}>
              Monthly booking revenue — 2026
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-sm"
            style={{ color: PLUM }}>
            <TrendingUp className="h-4 w-4" />
            <span className="font-semibold">+12.4%</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="plumGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={PLUM} stopOpacity={0.3} />
                <stop offset="95%" stopColor={PLUM} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3"
              stroke={`${BLACK}10`} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: GRAY_MID, fontSize: 12 }}
              axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: GRAY_MID, fontSize: 12 }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<RevenueTooltip />} />
            <Area
              type="monotone" dataKey="revenue"
              stroke={PLUM} strokeWidth={2}
              fill="url(#plumGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onNavigate?.(action.page)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl
                       transition-all duration-200 hover:-translate-y-0.5"
            style={action.primary ? {
              background: `linear-gradient(135deg, ${PLUM}, ${PLUM_MID})`,
              color: WHITE,
              boxShadow: `0 4px 16px ${PLUM}40`,
            } : {
              ...cardStyle,
              color: BLACK,
            }}
          >
            <action.icon className="h-5 w-5" />
            <span className="text-xs font-semibold">{action.label}</span>
          </button>
        ))}
      </div>

    </div>
  );
};

export default Dashboard;
