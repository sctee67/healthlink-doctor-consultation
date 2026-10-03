/**
 * Display helpers. Times are always shown in clinic time (Malaysia, UTC+8)
 * so what the patient sees matches the doctor's schedule, whatever the device zone.
 */
export const CLINIC_TIME_ZONE = 'Asia/Kuala_Lumpur';
export const BOOKING_WINDOW_DAYS = 14;
const OFFSET_MS = 8 * 3600_000;

const timeFmt = new Intl.DateTimeFormat('en-MY', {
  timeZone: CLINIC_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
// Fixed names rather than Intl month formatting: newer ICU renders September as "Sept"
// in en-GB, so output would differ between browsers.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "08 Sep 2026" for a clinic-local YYYY-MM-DD. */
function formatLongDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Clinic-local YYYY-MM-DD for an instant. */
export function clinicDate(instant: Date | string): string {
  return new Date(new Date(instant).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "3:30 PM" */
export function formatTime(instant: string): string {
  return timeFmt.format(new Date(instant)).toUpperCase();
}

/** "Today", "Tomorrow", or "08 Sep 2026" relative to `now`. */
export function formatDay(instant: string, now: Date = new Date()): string {
  const day = clinicDate(instant);
  const today = clinicDate(now);
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  if (day === addDays(today, -1)) return 'Yesterday';
  return formatLongDate(day);
}

/** "Today, 3:30 PM" — matches the mockup. */
export function formatDateTime(instant: string, now: Date = new Date()): string {
  return `${formatDay(instant, now)}, ${formatTime(instant)}`;
}

/** Label for a clinic-local date chip: { top: "Thu", bottom: "1 Oct" } or Today/Tomorrow. */
export function dayChipLabel(date: string, now: Date = new Date()): { top: string; bottom: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const today = clinicDate(now);
  const top = date === today ? 'Today' : date === addDays(today, 1) ? 'Tmrw' : WEEKDAYS[d.getUTCDay()]!;
  return { top, bottom: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
}

/** "09:00" → "9:00 AM" */
export function formatHm(hm: string): string {
  const [h = 0, m = 0] = hm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Clinic-local hour (0–23) of an instant; used to group slots into Morning/Afternoon/Evening. */
export function clinicHour(instant: string): number {
  return new Date(new Date(instant).getTime() + OFFSET_MS).getUTCHours();
}
