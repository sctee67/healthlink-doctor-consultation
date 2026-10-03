import type { Doctor } from '../domain/models.js';
import { Errors } from '../domain/errors.js';
import { BOOKING_WINDOW_DAYS, addDays, clinicDateOf } from '../domain/clinic-time.js';
import type { ConsultationRepository, DoctorRepository } from '../repositories/repositories.js';
import { availabilityOf, slotsForDay, type DoctorAvailability, type Slot } from './availability.js';

export type DoctorView = Doctor & { availability: DoctorAvailability };

export interface DoctorQuery {
  q?: string;
  specialty?: string;
}

export class DoctorService {
  constructor(
    private readonly doctors: DoctorRepository,
    private readonly consultations: ConsultationRepository,
    private readonly clock: () => Date,
  ) {}

  list(query: DoctorQuery = {}): DoctorView[] {
    const now = this.clock();
    const q = query.q?.trim().toLowerCase();
    const specialty = query.specialty?.trim().toLowerCase();
    return this.doctors
      .findAll()
      .filter((d) => !specialty || d.specialty.toLowerCase() === specialty)
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q))
      .map((d) => this.toView(d, now));
  }

  get(id: string): DoctorView {
    const doctor = this.doctors.findById(id);
    if (!doctor) throw Errors.notFound('Doctor');
    return this.toView(doctor, this.clock());
  }

  slots(id: string, date: string): { date: string; slots: Slot[] } {
    const doctor = this.doctors.findById(id);
    if (!doctor) throw Errors.notFound('Doctor');
    const now = this.clock();
    const today = clinicDateOf(now);
    if (date < today || date > addDays(today, BOOKING_WINDOW_DAYS - 1)) {
      throw Errors.unprocessable(
        'OUTSIDE_BOOKING_WINDOW',
        `Bookings are open for the next ${BOOKING_WINDOW_DAYS} days.`,
      );
    }
    return { date, slots: slotsForDay(doctor, date, now, this.bookedStarts(doctor.id)) };
  }

  /** UTC start times of this doctor's active bookings. */
  private bookedStarts(doctorId: string): Set<string> {
    return new Set(
      this.consultations
        .findByDoctor(doctorId)
        .filter((c) => c.status === 'scheduled')
        .map((c) => c.scheduledAt),
    );
  }

  private toView(doctor: Doctor, now: Date): DoctorView {
    return { ...doctor, availability: availabilityOf(doctor, now, this.bookedStarts(doctor.id)) };
  }
}
