import React from 'react';
import { StatusBadge, BtnSecondary, formatCurrency } from './ui/PremiumUI';
import { ArrowUpRight } from 'lucide-react';
import { NAVY, GOLD, IVORY, FONT_DISPLAY, cardStyle } from '../constants/design';
import type { Page } from '../types/navigation';

interface Booking {
  id: string;
  couple: string;
  date: string;
  guests: number;
  package: string;
  revenue: number;
  status: 'confirmed' | 'pending' | 'tour' | 'inquiry';
}

interface RecentBookingsTableProps {
  bookings: Booking[];
  onNavigate?: (page: Page) => void;
}

export const RecentBookingsTable: React.FC<RecentBookingsTableProps> = ({
  bookings,
  onNavigate,
}) => {
  return (
    <div className="rounded-xl overflow-hidden" style={cardStyle}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-5 border-b"
        style={{ borderColor: `${GOLD}25` }}
      >
        <h2
          className="text-xl font-semibold"
          style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
        >
          Recent Bookings
        </h2>
        <BtnSecondary
          icon={ArrowUpRight}
          onClick={() => onNavigate?.('events')}
        >
          View all
        </BtnSecondary>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: `${GOLD}08` }}>
              {['Couple', 'Event Date', 'Guests', 'Package', 'Revenue', 'Status'].map(
                (col) => (
                  <th
                    key={col}
                    className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: `${NAVY}70` }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking, i) => (
              <tr
                key={booking.id}
                className="transition-colors hover:bg-white/60 cursor-pointer"
                style={{
                  borderTop: i > 0 ? `1px solid ${GOLD}15` : undefined,
                }}
              >
                <td className="px-6 py-4">
                  <span
                    className="font-medium"
                    style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
                  >
                    {booking.couple}
                  </span>
                </td>
                <td className="px-6 py-4" style={{ color: `${NAVY}80` }}>
                  {booking.date}
                </td>
                <td className="px-6 py-4" style={{ color: `${NAVY}80` }}>
                  {booking.guests > 0 ? booking.guests : '—'}
                </td>
                <td className="px-6 py-4" style={{ color: `${NAVY}80` }}>
                  {booking.package}
                </td>
                <td
                  className="px-6 py-4 font-medium"
                  style={{ color: NAVY }}
                >
                  {formatCurrency(booking.revenue)}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge variant={booking.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentBookingsTable;
