import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { DoctorService } from '../services/doctor.service.js';
import type { ConsultationService } from '../services/consultation.service.js';
import { locals } from './middleware/middleware.js';
import {
  createConsultationSchema,
  idempotencyKeySchema,
  listConsultationsQuery,
  listDoctorsQuery,
  parse,
  slotsQuery,
} from './schemas.js';
import { BOOKING_WINDOW_DAYS, CLINIC_TIME_ZONE, SLOT_MINUTES } from '../domain/clinic-time.js';

export function doctorRoutes(doctors: DoctorService): Router {
  const r = Router();

  r.get('/', (req, res) => {
    res.json({ data: doctors.list(parse(listDoctorsQuery, req.query)) });
  });

  r.get('/:id', (req, res) => {
    res.json({ data: doctors.get(req.params.id) });
  });

  r.get('/:id/slots', (req, res) => {
    const { date } = parse(slotsQuery, req.query);
    res.json({ data: doctors.slots(req.params.id, date) });
  });

  return r;
}

export function consultationRoutes(consultations: ConsultationService, rateLimited: boolean): Router {
  const r = Router();
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: rateLimited ? 20 : Number.MAX_SAFE_INTEGER,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  r.get('/', (req, res) => {
    const { scope } = parse(listConsultationsQuery, req.query);
    res.json({ data: consultations.list(locals(res).patient.id, scope) });
  });

  r.get('/:id', (req, res) => {
    res.json({ data: consultations.get(locals(res).patient.id, req.params.id) });
  });

  r.post('/', writeLimiter, async (req, res) => {
    const input = parse(createConsultationSchema, req.body);
    const key = parse(idempotencyKeySchema, req.header('idempotency-key'));
    const { consultation, replayed } = await consultations.create(locals(res).patient.id, input, key);
    if (replayed) res.setHeader('Idempotent-Replayed', 'true');
    res
      .status(replayed ? 200 : 201)
      .location(`/api/consultations/${consultation.id}`)
      .json({ data: consultation });
  });

  r.post('/:id/cancel', writeLimiter, async (req, res) => {
    res.json({ data: await consultations.cancel(locals(res).patient.id, String(req.params.id)) });
  });

  return r;
}

export function metaRoutes(): Router {
  const r = Router();
  r.get('/me', (_req, res) => {
    res.json({ data: locals(res).patient });
  });
  r.get('/config', (_req, res) => {
    res.json({
      data: { timeZone: CLINIC_TIME_ZONE, slotMinutes: SLOT_MINUTES, bookingWindowDays: BOOKING_WINDOW_DAYS },
    });
  });
  return r;
}
