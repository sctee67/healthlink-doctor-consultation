import type { Doctor } from '../domain/models.js';
import {
  BOOKING_WINDOW_DAYS,
  MIN_LEAD_MINUTES,
  SLOT_MINUTES,
  addDays,
  clinicDateOf,
  clinicInstant,
  clinicMinutesOf,
  clinicWeekday,
  parseHm,
} from '../domain/clinic-time.js';

export type SlotUnavailableReason = 'booked' | 'past';

export interface Slot {
  startsAt: string;
  available: boolean;
  reason?: SlotUnavailableReason;
}

export type AvailabilityStatus = 'available_now' | 'available_later' | 'unavailable';

export interface DoctorAvailability {
  status: AvailabilityStatus;
  /** First bookable slot within the booking window, if any. */
  nextAvailableAt: string | null;
  /** Today's clinic-local hours, or null if the doctor is off today. */
  todayHours: { start: string; end: string } | null;
}

export function worksOn(doctor: Doctor, date: string): boolean {
  return doctor.hours.days.includes(clinicWeekday(date) as Doctor['hours']['days'][number]);
}

/** Slot grid for one clinic-local day. `booked` holds UTC ISO start times already taken. */
export function slotsForDay(doctor: Doctor, date: string, now: Date, booked: Set<string>): Slot[] {
  if (!worksOn(doctor, date)) return [];
  const start = parseHm(doctor.hours.start);
  const end = parseHm(doctor.hours.end);
  const earliest = now.getTime() + MIN_LEAD_MINUTES * 60_000;
  const slots: Slot[] = [];
  for (let m = start; m + SLOT_MINUTES <= end; m += SLOT_MINUTES) {
    const startsAt = clinicInstant(date, m).toISOString();
    if (Date.parse(startsAt) < earliest) slots.push({ startsAt, available: false, reason: 'past' });
    else if (booked.has(startsAt)) slots.push({ startsAt, available: false, reason: 'booked' });
    else slots.push({ startsAt, available: true });
  }
  return slots;
}

export function availabilityOf(doctor: Doctor, now: Date, booked: Set<string>): DoctorAvailability {
  const today = clinicDateOf(now);
  const nowMin = clinicMinutesOf(now);
  const working = worksOn(doctor, today);
  const inHours =
    working && nowMin >= parseHm(doctor.hours.start) && nowMin < parseHm(doctor.hours.end) - MIN_LEAD_MINUTES;

  let nextAvailableAt: string | null = null;
  for (let i = 0; i < BOOKING_WINDOW_DAYS && !nextAvailableAt; i++) {
    const slot = slotsForDay(doctor, addDays(today, i), now, booked).find((s) => s.available);
    if (slot) nextAvailableAt = slot.startsAt;
  }

  const freeToday = nextAvailableAt !== null && clinicDateOf(new Date(nextAvailableAt)) === today;
  return {
    status: inHours && freeToday ? 'available_now' : nextAvailableAt ? 'available_later' : 'unavailable',
    nextAvailableAt,
    todayHours: working ? { start: doctor.hours.start, end: doctor.hours.end } : null,
  };
}
