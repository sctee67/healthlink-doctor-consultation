import { addDays, clinicDate, clinicHour, dayChipLabel, formatDateTime, formatDay, formatHm } from './clinic-time';

// 2026-10-01 21:37 in Kuala Lumpur (UTC+8).
const NOW = new Date('2026-10-01T13:37:00Z');

describe('clinic-time', () => {
  it('derives the clinic-local date, not the UTC date', () => {
    // 17:30Z is already 01:30 the next day in KL.
    expect(clinicDate('2026-10-01T17:30:00Z')).toBe('2026-10-02');
    expect(clinicDate('2026-10-01T15:59:00Z')).toBe('2026-10-01');
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('labels today, tomorrow and yesterday relative to now', () => {
    expect(formatDay('2026-10-01T07:30:00Z', NOW)).toBe('Today');
    expect(formatDay('2026-10-02T01:00:00Z', NOW)).toBe('Tomorrow');
    expect(formatDay('2026-09-30T06:00:00Z', NOW)).toBe('Yesterday');
    expect(formatDay('2026-09-08T02:00:00Z', NOW)).toBe('08 Sep 2026');
  });

  it('formats date-times like the mockup', () => {
    expect(formatDateTime('2026-10-01T07:30:00Z', NOW)).toBe('Today, 3:30 PM');
  });

  it('formats HH:mm in 12-hour time', () => {
    expect(formatHm('09:00')).toBe('9:00 AM');
    expect(formatHm('12:00')).toBe('12:00 PM');
    expect(formatHm('22:30')).toBe('10:30 PM');
    expect(formatHm('00:15')).toBe('12:15 AM');
  });

  it('returns the clinic-local hour', () => {
    expect(clinicHour('2026-10-01T01:00:00Z')).toBe(9);
    expect(clinicHour('2026-10-01T13:00:00Z')).toBe(21);
  });

  it('labels day chips', () => {
    expect(dayChipLabel('2026-10-01', NOW)).toEqual({ top: 'Today', bottom: '1 Oct' });
    expect(dayChipLabel('2026-10-02', NOW)).toEqual({ top: 'Tmrw', bottom: '2 Oct' });
    expect(dayChipLabel('2026-10-03', NOW).top).toBe('Sat');
    expect(dayChipLabel('2026-09-08', NOW).bottom).toBe('8 Sep');
  });
});
