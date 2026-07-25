export const STATUS_COLORS: Record<string, string> = {
  lead: 'bg-slate-400', hold: 'bg-amber-400', booked: 'bg-blue-500', planning: 'bg-violet-500', completed: 'bg-green-500', cancelled: 'bg-rose-400', lost: 'bg-gray-400',
};
export function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}
export function safeJson(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  try { return JSON.parse(String(raw)); } catch { return {}; }
}
