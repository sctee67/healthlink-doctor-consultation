import { describe, expect, it } from 'vitest';
import { addDays, clinicDateOf, clinicInstant, clinicMinutesOf, isClinicDate } from '../src/domain/clinic-time.js';

describe('clinic time', () => {
  it('uses the Malaysian calendar day, not the UTC one', () => {
    // 20:00 UTC on 30 Sep is already 04:00 on 1 Oct in Kuala Lumpur.
    const instant = new Date('2026-09-30T20:00:00Z');
    expect(clinicDateOf(instant)).toBe('2026-10-01');
    expect(clinicMinutesOf(instant)).toBe(4 * 60);
  });

  it('round-trips date + minutes to a UTC instant', () => {
    expect(clinicInstant('2026-10-01', 15 * 60 + 30).toISOString()).toBe('2026-10-01T07:30:00.000Z');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('validates real calendar dates only', () => {
    expect(isClinicDate('2026-02-28')).toBe(true);
    expect(isClinicDate('2026-02-30')).toBe(false);
    expect(isClinicDate('2026-1-1')).toBe(false);
  });
});
