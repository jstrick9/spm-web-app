import { parseDateOnly } from '../../lib/formatDate';

export interface CountdownParts {
  isPast: boolean;
  days: number;
  hours: number;
  minutes: number;
}

/**
 * Wedding-day countdown parts, computed against LOCAL midnight of the
 * wedding date.
 *
 * `start_date` is DATE-ONLY ("YYYY-MM-DD") — `new Date('YYYY-MM-DD')`
 * parses as UTC midnight, which lands on the PREVIOUS evening in US
 * timezones and hours INTO the wedding day in UTC+ timezones. That made
 * the countdown show non-zero hours on the wedding day itself and flip to
 * "Celebration Time!" while the ceremony was still in progress. Parsing
 * via `parseDateOnly` targets local midnight of the wedding day, so the
 * countdown completes exactly when the wedding day begins.
 */
export function countdownParts(startDate: string | null | undefined, now: number): CountdownParts {
  if (!startDate) {
    return { isPast: false, days: 0, hours: 0, minutes: 0 };
  }
  const localMidnight = parseDateOnly(startDate);
  if (!localMidnight || Number.isNaN(localMidnight.getTime())) {
    return { isPast: false, days: 0, hours: 0, minutes: 0 };
  }
  const diff = localMidnight.getTime() - now;
  const isPast = diff <= 0;
  const abs = Math.abs(diff);
  return {
    isPast,
    days: Math.floor(abs / 86400000),
    hours: Math.floor((abs % 86400000) / 3600000),
    minutes: Math.floor((abs % 3600000) / 60000),
  };
}
