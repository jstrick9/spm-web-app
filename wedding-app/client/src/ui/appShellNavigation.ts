import { Brain, Calendar, Cog, FileBarChart, HelpCircle, Home, Layers, LayoutDashboard, Link2, Palette, Truck, Users } from 'lucide-react';

export interface NavItemMeta { icon: typeof Home; label: string; href: string; featureFlag?: string; permission?: string; }

export const NAV_ITEM_META: Record<
  string,
  {
    icon: typeof Home;
    label: string;
    href: string;
    featureFlag?: string;
    permission?: string;
  }
> = {
  dashboard: { icon: LayoutDashboard, label: "Dashboard", href: "#/" },
  events: { icon: Calendar, label: "Events", href: "#/events" },
  guests: {
    icon: Users,
    label: "Guests",
    href: "#/guests",
    permission: "guests.view",
  },
  vendors: {
    icon: Truck,
    label: "Vendors",
    href: "#/vendors",
    permission: "vendors.view",
  },
  calendar: { icon: Calendar, label: "Calendar", href: "#/calendar" },
  reports: {
    icon: FileBarChart,
    label: "Reports",
    href: "#/reports",
    featureFlag: "reports",
    permission: "reports.view",
  },
  intelligence: {
    icon: Brain,
    label: "Intelligence",
    href: "#/intelligence",
    featureFlag: "intelligence",
    permission: "reports.view",
  },
  system: {
    icon: Cog,
    label: "System",
    href: "#/system",
    permission: "platform.manage",
  },
  catalog: {
    icon: Layers,
    label: "Catalog Studio",
    href: "#/system/catalog",
    permission: "platform.manage",
  },
  questions: {
    icon: HelpCircle,
    label: "Questions Studio",
    href: "#/system/questions",
    permission: "platform.manage",
  },
  venue: {
    icon: Home,
    label: "Venue Builder",
    href: "#/system/venue",
    permission: "platform.manage",
  },
  integrations: {
    icon: Link2,
    label: "Integration Hub",
    href: "#/system/integrations",
    permission: "platform.manage",
  },
  branding: {
    icon: Palette,
    label: "Platform Studio",
    href: "#/system/platform",
    permission: "platform.manage",
  },
};

export const NAV_PERMISSION_IDS = [
  "guests.view",
  "vendors.view",
  "reports.view",
  "platform.manage",
] as const;

