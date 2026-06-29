import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Search,
  User,
  Menu,
  Command,
  ChevronRight,
  CalendarDays,
  Users,
  Mail,
  CheckCheck,
} from 'lucide-react';
import { ThemeSwitcher } from '../ThemeSwitcher';
import { NAVY, GOLD, IVORY, ROSE, FONT_DISPLAY } from '../../constants/design';
import type { Page } from '../../types/navigation';
import { PAGE_LABELS } from '../../types/navigation';

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  page?: Page;
}

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'New inquiry received',
    message: 'Grace & Thomas Hartley requested a venue tour.',
    time: '12 min ago',
    read: false,
    page: 'events',
  },
  {
    id: '2',
    title: 'RSVP confirmed',
    message: 'Margaret Whitmore accepted for Whitmore wedding.',
    time: '1 hr ago',
    read: false,
    page: 'guests',
  },
  {
    id: '3',
    title: 'Tour reminder',
    message: 'Chen family tour at 2:00 PM today.',
    time: '2 hrs ago',
    read: true,
    page: 'events',
  },
  {
    id: '4',
    title: 'Contract signed',
    message: 'Rivera wedding contract finalized.',
    time: 'Yesterday',
    read: true,
    page: 'events',
  },
];

interface HeaderProps {
  toggleSidebar: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onOpenCommandPalette: () => void;
  globalSearch: string;
  onGlobalSearchChange: (v: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  toggleSidebar,
  currentPage,
  onNavigate,
  onOpenCommandPalette,
  globalSearch,
  onGlobalSearchChange,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleNotifClick = (n: Notification) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
    );
    if (n.page) onNavigate(n.page);
    setNotifOpen(false);
  };

  return (
    <header
      className="h-16 flex items-center justify-between px-4 md:px-6 border-b sticky top-0 z-20"
      style={{
        backgroundColor: `${IVORY}F8`,
        backdropFilter: 'blur(12px)',
        borderColor: `${GOLD}25`,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg transition-colors md:hidden shrink-0"
          style={{ color: NAVY }}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <nav className="hidden sm:flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
          <span style={{ color: `${NAVY}50` }}>Seven Paths Manor</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: `${NAVY}30` }} />
          <span className="font-medium truncate" style={{ color: NAVY }}>
            {PAGE_LABELS[currentPage]}
          </span>
        </nav>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Global search */}
        <div className="relative hidden md:block">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
            style={{ color: `${NAVY}40` }}
          />
          <input
            type="search"
            value={globalSearch}
            onChange={(e) => onGlobalSearchChange(e.target.value)}
            placeholder="Search events, guests…"
            className="pl-9 pr-20 py-2 rounded-lg border text-sm w-56 lg:w-72 outline-none transition-all focus:w-80 focus:ring-2 focus:ring-[#C9A84C30]"
            style={{
              backgroundColor: IVORY,
              borderColor: `${GOLD}25`,
              color: NAVY,
            }}
          />
          <button
            onClick={onOpenCommandPalette}
            className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{ backgroundColor: `${NAVY}08`, color: `${NAVY}50`, border: `1px solid ${NAVY}10` }}
          >
            <Command className="h-3 w-3" />K
          </button>
        </div>

        <button
          onClick={onOpenCommandPalette}
          className="p-2 rounded-lg md:hidden"
          style={{ color: NAVY }}
          aria-label="Open command palette"
        >
          <Search className="h-5 w-5" />
        </button>

        <ThemeSwitcher />

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg transition-colors hover:bg-black/5"
            style={{ color: NAVY }}
            aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ backgroundColor: ROSE, color: NAVY }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl shadow-xl z-50 overflow-hidden"
              style={{ backgroundColor: IVORY, border: `1px solid ${GOLD}30` }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: `${GOLD}20` }}
              >
                <h3
                  className="font-semibold"
                  style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
                >
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs font-medium flex items-center gap-1"
                    style={{ color: GOLD }}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className="w-full text-left px-4 py-3 transition-colors hover:bg-white/60 border-b last:border-0"
                    style={{
                      borderColor: `${GOLD}10`,
                      backgroundColor: n.read ? 'transparent' : `${GOLD}06`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${GOLD}15` }}
                      >
                        {n.page === 'guests' ? (
                          <Users className="h-4 w-4" style={{ color: GOLD }} />
                        ) : n.page === 'events' ? (
                          <CalendarDays className="h-4 w-4" style={{ color: GOLD }} />
                        ) : (
                          <Mail className="h-4 w-4" style={{ color: GOLD }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" style={{ color: NAVY }}>
                          {n.title}
                        </p>
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: `${NAVY}70` }}>
                          {n.message}
                        </p>
                        <p className="text-[10px] mt-1" style={{ color: `${NAVY}40` }}>
                          {n.time}
                        </p>
                      </div>
                      {!n.read && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0 mt-2"
                          style={{ backgroundColor: GOLD }}
                        />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div
          className="flex items-center gap-2 pl-2 md:pl-3 border-l"
          style={{ borderColor: `${GOLD}25` }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ backgroundColor: NAVY, color: GOLD }}
          >
            JD
          </div>
          <div className="hidden md:block min-w-0">
            <p className="text-sm font-medium leading-tight truncate" style={{ color: NAVY }}>
              John Doe
            </p>
            <p className="text-[10px] truncate" style={{ color: `${NAVY}50` }}>
              Venue Manager
            </p>
          </div>
          <button
            className="hidden lg:flex p-2 rounded-lg transition-colors hover:bg-black/5"
            style={{ color: `${NAVY}60` }}
            aria-label="User profile"
          >
            <User className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
