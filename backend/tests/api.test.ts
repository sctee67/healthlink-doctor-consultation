import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

// Thursday 1 Oct 2026, 10:00 in Kuala Lumpur (UTC+8).
const START = new Date('2026-10-01T02:00:00Z');
const myt = (date: string, hm: string) => new Date(`${date}T${hm}:00+08:00`).toISOString();

let now: Date;
let app: Express;

beforeEach(() => {
  now = new Date(START);
  app = createApp({ config: loadConfig({ STORAGE: 'memory' }), clock: () => now, quiet: true });
});

const book = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
  request(app).post('/api/consultations').set(headers).send({
    doctorId: 'doc_sarah_lim',
    type: 'chat',
    scheduledAt: myt('2026-10-01', '15:00'),
    reason: 'Fever and sore throat for 2 days',
    ...body,
  });

describe('GET /api/doctors', () => {
  it('lists seeded doctors with computed availability', async () => {
    const res = await request(app).get('/api/doctors').expect(200);
    expect(res.body.data).toHaveLength(5);

    const sarah = res.body.data.find((d: { id: string }) => d.id === 'doc_sarah_lim');
    expect(sarah.availability.status).toBe('available_now');

    // Dr. Tan works weekdays 14:00–20:00, so at 10:00 he is available later today.
    const daniel = res.body.data.find((d: { id: string }) => d.id === 'doc_daniel_tan');
    expect(daniel.availability).toMatchObject({
      status: 'available_later',
      nextAvailableAt: myt('2026-10-01', '14:00'),
    });
  });

  it('filters by free-text query', async () => {
    const res = await request(app).get('/api/doctors?q=derma').expect(200);
    expect(res.body.data.map((d: { id: string }) => d.id)).toEqual(['doc_daniel_tan']);
  });

  it('returns 404 problem+json for an unknown doctor', async () => {
    const res = await request(app).get('/api/doctors/nope').expect(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(res.body.requestId).toBeTruthy();
  });
});

describe('GET /api/doctors/:id/slots', () => {
  it('marks past and booked slots unavailable', async () => {
    const today = await request(app).get('/api/doctors/doc_sarah_lim/slots?date=2026-10-01').expect(200);
    const byTime = new Map(today.body.data.slots.map((s: { startsAt: string }) => [s.startsAt, s]));
    expect(byTime.get(myt('2026-10-01', '09:30'))).toMatchObject({ available: false, reason: 'past' });
    expect(byTime.get(myt('2026-10-01', '10:30'))).toMatchObject({ available: true });
    // Last slot ends exactly at closing time.
    expect(today.body.data.slots.at(-1).startsAt).toBe(myt('2026-10-01', '21:30'));

    // Seed has John booked with Dr. Lim tomorrow at 15:30.
    const tomorrow = await request(app).get('/api/doctors/doc_sarah_lim/slots?date=2026-10-02').expect(200);
    const seeded = tomorrow.body.data.slots.find((s: { startsAt: string }) => s.startsAt === myt('2026-10-02', '15:30'));
    expect(seeded).toMatchObject({ available: false, reason: 'booked' });
  });

  it('returns no slots on a doctor\'s day off', async () => {
    const res = await request(app).get('/api/doctors/doc_daniel_tan/slots?date=2026-10-04').expect(200); // Sunday
    expect(res.body.data.slots).toEqual([]);
  });

  it('rejects malformed and out-of-window dates', async () => {
    await request(app).get('/api/doctors/doc_sarah_lim/slots?date=2026-13-01').expect(400);
    await request(app).get('/api/doctors/doc_sarah_lim/slots?date=2026-09-30').expect(422);
    await request(app).get('/api/doctors/doc_sarah_lim/slots?date=2026-10-15').expect(422);
  });
});

describe('POST /api/consultations', () => {
  it('creates a booking that then appears in upcoming consultations', async () => {
    const res = await book({}).expect(201);
    expect(res.headers['location']).toBe(`/api/consultations/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      status: 'scheduled',
      type: 'chat',
      durationMinutes: 30,
      doctor: { id: 'doc_sarah_lim', name: 'Dr. Sarah Lim' },
    });
    expect(res.body.data.patientId).toBeUndefined();

    const list = await request(app).get('/api/consultations?scope=upcoming').expect(200);
    expect(list.body.data[0].id).toBe(res.body.data.id); // soonest first
  });

  it('returns field-level validation errors', async () => {
    const res = await book({ type: 'phone', reason: 'hi', scheduledAt: 'tomorrow' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['reason', 'scheduledAt', 'type']);
  });

  it('trims the reason and rejects whitespace-only input', async () => {
    await book({ reason: '        ' }).expect(400);
    const res = await book({ reason: '   Persistent headache   ' }).expect(201);
    expect(res.body.data.reason).toBe('Persistent headache');
  });

  it.each([
    ['INVALID_SLOT', { scheduledAt: myt('2026-10-01', '15:10') }],
    ['SLOT_IN_PAST', { scheduledAt: myt('2026-10-01', '09:30') }],
    ['OUTSIDE_DOCTOR_HOURS', { scheduledAt: myt('2026-10-01', '22:00') }],
    ['OUTSIDE_DOCTOR_HOURS', { doctorId: 'doc_daniel_tan', scheduledAt: myt('2026-10-04', '15:00') }],
    ['OUTSIDE_BOOKING_WINDOW', { scheduledAt: myt('2026-10-20', '10:00') }],
    ['TYPE_NOT_OFFERED', { doctorId: 'doc_nurul_huda', type: 'chat' }],
  ])('rejects %s with 422', async (code, body) => {
    const res = await book(body).expect(422);
    expect(res.body.code).toBe(code);
  });

  it('returns 404 for an unknown doctor', async () => {
    await book({ doctorId: 'doc_missing' }).expect(404);
  });

  it('prevents double-booking a doctor slot and a patient time', async () => {
    await book({}).expect(201);
    expect((await book({}).expect(409)).body.code).toBe('SLOT_TAKEN');
    const clash = await book({ doctorId: 'doc_aiman_rashid' }).expect(409);
    expect(clash.body.code).toBe('PATIENT_DOUBLE_BOOKED');
  });

  it('replays the original booking for a repeated Idempotency-Key', async () => {
    const headers = { 'Idempotency-Key': 'retry-key-123456' };
    const first = await book({}, headers).expect(201);
    const second = await book({}, headers).expect(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.data.id).toBe(first.body.data.id);

    const list = await request(app).get('/api/consultations?scope=upcoming');
    expect(list.body.data).toHaveLength(2); // seeded one + this one, not three
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/consultations')
      .set('Content-Type', 'application/json')
      .send('{"doctorId":')
      .expect(400);
    expect(res.body.code).toBe('MALFORMED_JSON');
  });
});

describe('GET /api/consultations', () => {
  it('splits upcoming and past, newest history first', async () => {
    const upcoming = await request(app).get('/api/consultations?scope=upcoming').expect(200);
    expect(upcoming.body.data.map((c: { id: string }) => c.id)).toEqual(['cons_seed_1']);

    const past = await request(app).get('/api/consultations?scope=past').expect(200);
    expect(past.body.data.map((c: { id: string }) => c.id)).toEqual(['cons_seed_2', 'cons_seed_3']);
    expect(past.body.data.every((c: { status: string }) => c.status === 'completed')).toBe(true);
  });

  it('reports a scheduled consultation as completed once it has ended', async () => {
    now = new Date(myt('2026-10-02', '16:00')); // seeded 15:30–16:00 session just ended
    const res = await request(app).get('/api/consultations/cons_seed_1').expect(200);
    expect(res.body.data.status).toBe('completed');
  });

  it('rejects an unknown patient identity', async () => {
    await request(app).get('/api/consultations').set('X-Patient-Id', 'pat_nobody').expect(401);
  });
});

describe('POST /api/consultations/:id/cancel', () => {
  it('cancels a scheduled consultation and frees the slot', async () => {
    const res = await request(app).post('/api/consultations/cons_seed_1/cancel').expect(200);
    expect(res.body.data.status).toBe('cancelled');

    await request(app).post('/api/consultations/cons_seed_1/cancel').expect(409);
    await book({ scheduledAt: myt('2026-10-02', '15:30') }).expect(201);
  });

  it('refuses to cancel a completed consultation', async () => {
    const res = await request(app).post('/api/consultations/cons_seed_2/cancel').expect(409);
    expect(res.body.code).toBe('NOT_CANCELLABLE');
  });
});

it('returns problem+json for unknown routes', async () => {
  const res = await request(app).get('/api/unknown').expect(404);
  expect(res.body.code).toBe('NOT_FOUND');
});
