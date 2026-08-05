import { describe, it, expect } from 'vitest';
import { eventDaysUntil, applyManagerPipelineFilter } from './eventsListPanels';
import type { SdkEvent } from '../../sdk/types';

function event(overrides: Partial<SdkEvent> = {}): SdkEvent {
  return {
    id: 'e1', organization_id: 'org1', title: 'Wedding', slug: 'w1', status: 'planning',
    start_date: null, end_date: null, guest_count: 0, budget_cents: null,
    metadata: '{}', created_at: '', primary_contact_user_id: null,
    ...overrides,
  };
}

function localDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

describe('eventDaysUntil', () => {
  it('returns 0 for today, 1 for tomorrow, -1 for yesterday (local calendar days)', () => {
    expect(eventDaysUntil(event({ start_date: localDateString(0) }))).toBe(0);
    expect(eventDaysUntil(event({ start_date: localDateString(1) }))).toBe(1);
    expect(eventDaysUntil(event({ start_date: localDateString(-1) }))).toBe(-1);
  });

  it('is timezone-safe: an event today never counts as tomorrow before noon', () => {
    // Regression: parsing "YYYY-MM-DD" as UTC midnight made "day of" fire
    // up to ~12h early (e.g. the evening before) in US timezones.
    const today = localDateString(0);
    // The event is today by the calendar — regardless of the current clock,
    // the calendar-day difference is exactly 0.
    expect(eventDaysUntil(event({ start_date: today }))).toBe(0);
  });

  it('returns null without a start date', () => {
    expect(eventDaysUntil(event({ start_date: null }))).toBeNull();
  });
});

describe('applyManagerPipelineFilter', () => {
  it('day_of selects only events whose calendar day is today', () => {
    const today = event({ id: 'today', start_date: localDateString(0) });
    const tomorrow = event({ id: 'tomorrow', start_date: localDateString(1) });
    const none = event({ id: 'none', start_date: null });
    const out = applyManagerPipelineFilter([today, tomorrow, none], 'day_of');
    expect(out.map((e) => e.id)).toEqual(['today']);
  });

  it('event_week selects events within 7 days, excluding completed', () => {
    const inWeek = event({ id: 'in', start_date: localDateString(3) });
    const far = event({ id: 'far', start_date: localDateString(30) });
    const done = event({ id: 'done', start_date: localDateString(2), status: 'completed' });
    const out = applyManagerPipelineFilter([inWeek, far, done], 'event_week');
    expect(out.map((e) => e.id)).toEqual(['in']);
  });

  it('upcoming_tours requires lead status + tour date', () => {
    const leadWithTour = event({ id: 'a', status: 'lead', metadata: JSON.stringify({ tourDate: '2026-09-01' }) });
    const leadNoTour = event({ id: 'b', status: 'lead' });
    const bookedWithTour = event({ id: 'c', status: 'booked', metadata: JSON.stringify({ tourDate: '2026-09-01' }) });
    const out = applyManagerPipelineFilter([leadWithTour, leadNoTour, bookedWithTour], 'upcoming_tours');
    expect(out.map((e) => e.id)).toEqual(['a']);
  });

  it('booked_events selects booked + planning', () => {
    const out = applyManagerPipelineFilter(
      [event({ id: 'a', status: 'booked' }), event({ id: 'b', status: 'planning' }), event({ id: 'c', status: 'lead' })],
      'booked_events',
    );
    expect(out.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
