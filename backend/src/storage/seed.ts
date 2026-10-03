import type { DbSchema } from './store.js';
import type { Consultation, Doctor } from '../domain/models.js';
import { clinicDateOf, clinicInstant, addDays, parseHm } from '../domain/clinic-time.js';

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6] as const;
const WEEKDAYS = [1, 2, 3, 4, 5] as const;

export const SEED_DOCTORS: Doctor[] = [
  {
    id: 'doc_sarah_lim',
    name: 'Dr. Sarah Lim',
    specialty: 'General Practitioner',
    bio: 'Everyday illnesses, chronic disease follow-ups and preventive care.',
    languages: ['English', 'Mandarin', 'Malay'],
    yearsOfExperience: 9,
    rating: 4.9,
    consultationTypes: ['chat', 'video'],
    feeMyr: 25,
    hours: { days: [...EVERY_DAY], start: '09:00', end: '22:00' },
  },
  {
    id: 'doc_aiman_rashid',
    name: 'Dr. Aiman Rashid',
    specialty: 'Family Medicine',
    bio: 'Care for the whole family, from children to seniors.',
    languages: ['English', 'Malay'],
    yearsOfExperience: 12,
    rating: 4.8,
    consultationTypes: ['chat', 'video'],
    feeMyr: 30,
    hours: { days: [...EVERY_DAY], start: '09:00', end: '22:00' },
  },
  {
    id: 'doc_priya_nair',
    name: 'Dr. Priya Nair',
    specialty: 'Internal Medicine',
    bio: 'Diabetes, hypertension and complex adult conditions.',
    languages: ['English', 'Tamil', 'Malay'],
    yearsOfExperience: 15,
    rating: 4.9,
    consultationTypes: ['chat', 'video'],
    feeMyr: 45,
    hours: { days: [...EVERY_DAY], start: '09:00', end: '22:00' },
  },
  {
    id: 'doc_daniel_tan',
    name: 'Dr. Daniel Tan',
    specialty: 'Dermatology',
    bio: 'Acne, eczema, rashes and other skin concerns — photos welcome in chat.',
    languages: ['English', 'Mandarin', 'Cantonese'],
    yearsOfExperience: 8,
    rating: 4.7,
    consultationTypes: ['chat', 'video'],
    feeMyr: 60,
    hours: { days: [...WEEKDAYS], start: '14:00', end: '20:00' },
  },
  {
    id: 'doc_nurul_huda',
    name: 'Dr. Nurul Huda',
    specialty: 'Paediatrics',
    bio: 'Fever, coughs, rashes and development questions for little ones.',
    languages: ['English', 'Malay'],
    yearsOfExperience: 11,
    rating: 4.9,
    consultationTypes: ['video'],
    feeMyr: 50,
    hours: { days: [1, 2, 3, 4, 5, 6], start: '09:00', end: '17:00' },
  },
];

function consultation(
  id: string,
  doctorId: string,
  type: Consultation['type'],
  scheduledAt: Date,
  reason: string,
  status: Consultation['status'],
): Consultation {
  const createdAt = new Date(scheduledAt.getTime() - 2 * 24 * 3600_000).toISOString();
  return {
    id,
    patientId: 'pat_john',
    doctorId,
    type,
    scheduledAt: scheduledAt.toISOString(),
    durationMinutes: 30,
    reason,
    status,
    createdAt,
  };
}

/** Seed data is relative to "now" so the demo always has upcoming and past items. */
export function buildSeed(now: Date = new Date()): DbSchema {
  const today = clinicDateOf(now);
  return {
    doctors: SEED_DOCTORS,
    patients: [{ id: 'pat_john', name: 'John Ong' }],
    consultations: [
      consultation(
        'cons_seed_1',
        'doc_sarah_lim',
        'chat',
        clinicInstant(addDays(today, 1), parseHm('15:30')),
        'Follow-up on persistent dry cough after flu.',
        'scheduled',
      ),
      consultation(
        'cons_seed_2',
        'doc_aiman_rashid',
        'video',
        clinicInstant(addDays(today, -3), parseHm('10:00')),
        'Annual health review and blood test results.',
        'completed',
      ),
      consultation(
        'cons_seed_3',
        'doc_priya_nair',
        'chat',
        clinicInstant(addDays(today, -9), parseHm('14:00')),
        'Blood pressure medication adjustment.',
        'completed',
      ),
    ],
    idempotency: [],
  };
}
