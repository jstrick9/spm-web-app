import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  PenTool,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { NAVY, GOLD, IVORY, ROSE, FONT_DISPLAY } from '../../constants/design';
import type { Page } from '../../types/navigation';
import { PAGE_LABELS } from '../../types/navigation';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ElementType;
  hint?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Overview & metrics' },
  { id: 'events', label: 'Events', icon: CalendarDays, hint: 'Bookings & tours' },
  { id: 'guests', label: 'Guest List', icon: Users, hint: 'RSVPs & seating' },
  { id: 'floorplan', label: 'Floor Plan', icon: PenTool, hint: 'Layouts & tables' },
  { id: 'settings', label: 'Settings', icon: Settings, hint: 'Venue & team' },
];

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  currentPage,
  onNavigate,
}) => {
  return (
    <>
      {!isOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-2.5 rounded-lg shadow-lg md:hidden"
          style={{ backgroundColor: NAVY, color: GOLD }}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-in-out flex flex-col
          ${isOpen ? 'w-64' : 'w-[72px]'}
          md:translate-x-0 -translate-x-full md:translate-x-0
        `}
        style={{
          backgroundColor: NAVY,
          borderRight: `1px solid ${GOLD}20`,
        }}
      >
        {/* Logo */}
        <div
          className="h-16 flex items-center px-4 border-b shrink-0"
          style={{ borderColor: `${GOLD}15` }}
        >
          {isOpen ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${GOLD}20`, border: `1px solid ${GOLD}35` }}
              >
                <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-bold leading-tight truncate"
                  style={{ fontFamily: FONT_DISPLAY, color: IVORY }}
                >
                  Seven Paths
                </p>
                <p className="text-[10px] tracking-widest uppercase" style={{ color: GOLD }}>
                  Manor
                </p>
              </div>
            </div>
          ) : (
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mx-auto"
              style={{ backgroundColor: `${GOLD}20`, border: `1px solid ${GOLD}35` }}
            >
              <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
          {isOpen && (
            <p
              className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: `${IVORY}40` }}
            >
              Main Menu
            </p>
          )}
          {navItems.map((item) => {
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={!isOpen ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group
                  ${isOpen ? 'justify-start' : 'justify-center'}
                  ${active ? 'shadow-sm' : 'hover:bg-white/5'}
                `}
                style={
                  active
                    ? {
                        backgroundColor: `${GOLD}18`,
                        borderLeft: `3px solid ${GOLD}`,
                        color: IVORY,
                      }
                    : { color: `${IVORY}75`, borderLeft: '3px solid transparent' }
                }
              >
                <item.icon
                  className="h-5 w-5 shrink-0 transition-colors"
                  style={{ color: active ? GOLD : `${IVORY}60` }}
                />
                {isOpen && (
                  <div className="min-w-0 text-left">
                    <span className="text-sm font-medium block truncate">{item.label}</span>
                    {item.hint && (
                      <span className="text-[10px] block truncate" style={{ color: `${IVORY}40` }}>
                        {item.hint}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t shrink-0 space-y-1" style={{ borderColor: `${GOLD}15` }}>
          {isOpen && (
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
              style={{ color: `${IVORY}60` }}
            >
              <HelpCircle className="h-4 w-4 shrink-0" />
              <span>Help & Support</span>
            </button>
          )}
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center p-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: `${IVORY}60` }}
            aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-sm"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
    </>
  );
};
