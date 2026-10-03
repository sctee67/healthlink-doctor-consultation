import { z } from 'zod';
import { Errors } from '../domain/errors.js';
import { isClinicDate } from '../domain/clinic-time.js';

export const REASON_MIN = 5;
export const REASON_MAX = 500;

export const createConsultationSchema = z.object({
  doctorId: z.string().trim().min(1, 'Doctor is required.'),
  type: z.enum(['chat', 'video'], { error: 'Choose Chat or Video.' }),
  scheduledAt: z.iso.datetime({ offset: true, error: 'Must be an ISO-8601 date-time.' }),
  reason: z
    .string({ error: 'Reason for visit is required.' })
    .trim()
    .min(REASON_MIN, `Please describe your reason in at least ${REASON_MIN} characters.`)
    .max(REASON_MAX, `Keep it under ${REASON_MAX} characters.`),
});

export const listConsultationsQuery = z.object({
  scope: z.enum(['upcoming', 'past', 'all']).default('all'),
});

export const listDoctorsQuery = z.object({
  q: z.string().max(100).optional(),
  specialty: z.string().max(100).optional(),
});

export const slotsQuery = z.object({
  date: z.string().refine(isClinicDate, 'Must be a date in YYYY-MM-DD format.'),
});

export const idempotencyKeySchema = z.string().trim().min(8).max(128).optional();

/** Parses input or throws a 400 with per-field messages. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw Errors.validation(
      result.error.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message })),
    );
  }
  return result.data;
}
