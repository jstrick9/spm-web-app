export type Page = 'dashboard' | 'events' | 'guests' | 'floorplan' | 'settings';

export const PAGE_LABELS: Record<Page, string> = {
  dashboard: 'Dashboard',
  events: 'Events',
  guests: 'Guest List',
  floorplan: 'Floor Plan',
  settings: 'Settings',
};
