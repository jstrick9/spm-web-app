import React from 'react';
import { Table } from '../components/ui/PremiumUI';

interface Booking {
  id: string;
  couple: string;
  date: string;
  guests: number;
  package: string;
  revenue: number;
  status: 'confirmed' | 'pending' | 'tour' | 'inquiry';
}

const recentBookings = [
  { id: '1', couple: 'Emily & James Whitmore', date: 'Jun 28, 2026', guests: 180, package: 'Grand Estate', revenue: 48500, status: 'confirmed' },
  { id: '2', couple: 'Sophia & Michael Chen', date: 'Jul 12, 2026', guests: 120, package: 'Garden Pavilion', revenue: 32000, status: 'pending' },
  { id: '3', couple: 'Olivia & Daniel Brooks', date: 'Jul 19, 2026', guests: 95, package: 'Intimate Courtyard', revenue: 22800, status: 'tour' },
  { id: '4', couple: 'Isabella & Marcus Rivera', date: 'Aug 3, 2026', guests: 210, package: 'Grand Estate', revenue: 52000, status: 'confirmed' },
  { id: '5', couple: 'Grace & Thomas Hartley', date: 'Aug 17, 2026', guests: 0, package: 'TBD', revenue: 0, status: 'inquiry' },
];

const Dashboard = () => {
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
      {/* ... */}
      <RecentBookingsTable bookings={recentBookings} />
      {/* ... */}
    </div>
  );
};
export default Dashboard;