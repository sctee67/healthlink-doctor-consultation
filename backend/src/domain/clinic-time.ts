/**
 * All scheduling happens in clinic-local time (Malaysia, UTC+8, no DST),
 * while everything on the wire and on disk is UTC ISO-8601.
 * Because MYT has no daylight saving, a fixed offset is exact.
 */
export const CLINIC_TIME_ZONE = 'Asia/Kuala_Lumpur';
export const CLINIC_UTC_OFFSET = '+08:00';
const OFFSET_MS = 8 * 60 * 60 * 1000;

export const SLOT_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 14;
/** Minimum notice before a slot can be booked. */
export const MIN_LEAD_MINUTES = 10;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isClinicDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Clinic-local calendar date (YYYY-MM-DD) for an instant. */
export function clinicDateOf(instant: Date): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Minutes since clinic-local midnight for an instant. */
export function clinicMinutesOf(instant: Date): number {
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function clinicWeekday(date: string): number {
  // A calendar date's weekday is independent of time zone.
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Instant for a clinic-local date + minutes-from-midnight. */
export function clinicInstant(date: string, minutes: number): Date {
  const midnightUtc = new Date(`${date}T00:00:00${CLINIC_UTC_OFFSET}`).getTime();
  return new Date(midnightUtc + minutes * 60_000);
}
