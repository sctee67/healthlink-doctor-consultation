/** Wire types — mirror the backend's response DTOs. All timestamps are UTC ISO-8601. */

export type ConsultationType = 'chat' | 'video';
export type ConsultationStatus = 'scheduled' | 'completed' | 'cancelled';
export type ConsultationScope = 'upcoming' | 'past' | 'all';
export type AvailabilityStatus = 'available_now' | 'available_later' | 'unavailable';

export interface DoctorAvailability {
  status: AvailabilityStatus;
  nextAvailableAt: string | null;
  todayHours: { start: string; end: string } | null;
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
  hours: { days: number[]; start: string; end: string };
  avatarUrl?: string;
  availability: DoctorAvailability;
}

export interface Slot {
  startsAt: string;
  available: boolean;
  reason?: 'booked' | 'past';
}

export interface Consultation {
  id: string;
  doctorId: string;
  type: ConsultationType;
  scheduledAt: string;
  endsAt: string;
  durationMinutes: number;
  reason: string;
  status: ConsultationStatus;
  createdAt: string;
  cancelledAt?: string;
  doctor: { id: string; name: string; specialty: string; avatarUrl?: string };
}

export interface CreateConsultationRequest {
  doctorId: string;
  type: ConsultationType;
  scheduledAt: string;
  reason: string;
}

export interface Patient {
  id: string;
  name: string;
}

export interface ApiEnvelope<T> {
  data: T;
}

export const REASON_MIN = 5;
export const REASON_MAX = 500;
