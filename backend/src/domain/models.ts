export type ConsultationType = 'chat' | 'video';

/** Persisted status. `completed` is also derived at read time once a session has ended. */
export type ConsultationStatus = 'scheduled' | 'completed' | 'cancelled';

/** ISO weekday: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WorkingHours {
  days: Weekday[];
  /** Clinic-local "HH:mm" */
  start: string;
  /** Clinic-local "HH:mm" (exclusive) */
  end: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  languages: string[];
  yearsOfExperience: number;
  rating: number;
  consultationTypes: ConsultationType[];
  feeMyr: number;
  hours: WorkingHours;
  avatarUrl?: string;
}

export interface Patient {
  id: string;
  name: string;
}

export interface Consultation {
  id: string;
  patientId: string;
  doctorId: string;
  type: ConsultationType;
  /** UTC ISO-8601 */
  scheduledAt: string;
  durationMinutes: number;
  reason: string;
  status: ConsultationStatus;
  createdAt: string;
  cancelledAt?: string;
}

export interface IdempotencyRecord {
  key: string;
  patientId: string;
  consultationId: string;
  createdAt: string;
}
