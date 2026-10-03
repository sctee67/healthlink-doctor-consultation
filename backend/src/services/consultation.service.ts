import { randomUUID } from 'node:crypto';
import type { Consultation, ConsultationStatus, ConsultationType, Doctor } from '../domain/models.js';
import { Errors } from '../domain/errors.js';
import {
  BOOKING_WINDOW_DAYS,
  MIN_LEAD_MINUTES,
  SLOT_MINUTES,
  addDays,
  clinicDateOf,
  clinicMinutesOf,
  parseHm,
} from '../domain/clinic-time.js';
import type {
  ConsultationRepository,
  DoctorRepository,
  IdempotencyRepository,
} from '../repositories/repositories.js';
import { worksOn } from './availability.js';

export interface CreateConsultationInput {
  doctorId: string;
  type: ConsultationType;
  scheduledAt: string;
  reason: string;
}

export type ConsultationScope = 'upcoming' | 'past' | 'all';

export interface ConsultationView extends Omit<Consultation, 'patientId'> {
  endsAt: string;
  doctor: Pick<Doctor, 'id' | 'name' | 'specialty' | 'avatarUrl'>;
}

export class ConsultationService {
  constructor(
    private readonly consultations: ConsultationRepository,
    private readonly doctors: DoctorRepository,
    private readonly idempotency: IdempotencyRepository,
    private readonly clock: () => Date,
  ) {}

  list(patientId: string, scope: ConsultationScope = 'all'): ConsultationView[] {
    const now = this.clock();
    const isUpcoming = (v: ConsultationView) => v.status === 'scheduled';
    const views = this.consultations
      .findByPatient(patientId)
      .map((c) => this.toView(c, now))
      .filter((v) => scope === 'all' || (scope === 'upcoming') === isUpcoming(v));

    // Upcoming first, soonest first; then history, most recent first.
    return views.sort((a, b) => {
      if (isUpcoming(a) !== isUpcoming(b)) return isUpcoming(a) ? -1 : 1;
      const diff = Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt);
      return isUpcoming(a) ? diff : -diff;
    });
  }

  get(patientId: string, id: string): ConsultationView {
    const c = this.consultations.findById(id);
    // Same 404 for "not yours" as for "does not exist", so ids of other patients are not revealed.
    if (!c || c.patientId !== patientId) throw Errors.notFound('Consultation');
    return this.toView(c, this.clock());
  }

  /**
   * Returns `replayed: true` when an Idempotency-Key matched a previous request,
   * so double-clicks and network retries never create duplicate bookings.
   */
  async create(
    patientId: string,
    input: CreateConsultationInput,
    idempotencyKey?: string,
  ): Promise<{ consultation: ConsultationView; replayed: boolean }> {
    const now = this.clock();

    if (idempotencyKey) {
      const prior = this.idempotency.find(patientId, idempotencyKey, now);
      if (prior) return { consultation: this.get(patientId, prior.consultationId), replayed: true };
    }

    const doctor = this.doctors.findById(input.doctorId);
    if (!doctor) throw Errors.notFound('Doctor');
    if (!doctor.consultationTypes.includes(input.type)) {
      throw Errors.unprocessable(
        'TYPE_NOT_OFFERED',
        `${doctor.name} does not offer ${input.type} consultations.`,
      );
    }

    const startsAt = new Date(input.scheduledAt);
    this.assertBookableTime(doctor, startsAt, now);
    const scheduledAt = startsAt.toISOString();

    // Everything from here to insert() is synchronous, so no other request can interleave.
    const clashes = (c: Consultation) => c.status === 'scheduled' && c.scheduledAt === scheduledAt;
    if (this.consultations.findByDoctor(doctor.id).some(clashes)) {
      throw Errors.conflict('SLOT_TAKEN', 'That time was just booked. Please pick another slot.');
    }
    if (this.consultations.findByPatient(patientId).some(clashes)) {
      throw Errors.conflict('PATIENT_DOUBLE_BOOKED', 'You already have a consultation at that time.');
    }

    const consultation: Consultation = {
      id: `cons_${randomUUID()}`,
      patientId,
      doctorId: doctor.id,
      type: input.type,
      scheduledAt,
      durationMinutes: SLOT_MINUTES,
      reason: input.reason.trim(),
      status: 'scheduled',
      createdAt: now.toISOString(),
    };
    this.consultations.insert(consultation);
    if (idempotencyKey) {
      this.idempotency.save(
        { key: idempotencyKey, patientId, consultationId: consultation.id, createdAt: now.toISOString() },
        now,
      );
    }
    await this.consultations.flush();
    return { consultation: this.toView(consultation, now), replayed: false };
  }

  async cancel(patientId: string, id: string): Promise<ConsultationView> {
    const view = this.get(patientId, id);
    if (view.status !== 'scheduled') {
      throw Errors.conflict('NOT_CANCELLABLE', `A ${view.status} consultation cannot be cancelled.`);
    }
    const now = this.clock();
    const updated = this.consultations.update(id, { status: 'cancelled', cancelledAt: now.toISOString() });
    await this.consultations.flush();
    return this.toView(updated!, now);
  }

  private assertBookableTime(doctor: Doctor, startsAt: Date, now: Date): void {
    const onBoundary =
      startsAt.getUTCSeconds() === 0 &&
      startsAt.getUTCMilliseconds() === 0 &&
      clinicMinutesOf(startsAt) % SLOT_MINUTES === 0;
    if (!onBoundary) {
      throw Errors.unprocessable('INVALID_SLOT', `Times must start on a ${SLOT_MINUTES}-minute boundary.`);
    }
    if (startsAt.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) {
      throw Errors.unprocessable('SLOT_IN_PAST', 'That time has already passed. Please pick a later slot.');
    }
    const date = clinicDateOf(startsAt);
    if (date > addDays(clinicDateOf(now), BOOKING_WINDOW_DAYS - 1)) {
      throw Errors.unprocessable(
        'OUTSIDE_BOOKING_WINDOW',
        `Bookings are open for the next ${BOOKING_WINDOW_DAYS} days.`,
      );
    }
    const minutes = clinicMinutesOf(startsAt);
    if (
      !worksOn(doctor, date) ||
      minutes < parseHm(doctor.hours.start) ||
      minutes + SLOT_MINUTES > parseHm(doctor.hours.end)
    ) {
      throw Errors.unprocessable('OUTSIDE_DOCTOR_HOURS', `${doctor.name} is not available at that time.`);
    }
  }

  private toView(c: Consultation, now: Date): ConsultationView {
    const doctor = this.doctors.findById(c.doctorId);
    const endsAt = new Date(Date.parse(c.scheduledAt) + c.durationMinutes * 60_000);
    // A scheduled session whose end time has passed is reported as completed.
    const status: ConsultationStatus = c.status === 'scheduled' && endsAt <= now ? 'completed' : c.status;
    const { patientId: _patientId, ...rest } = c;
    return {
      ...rest,
      status,
      endsAt: endsAt.toISOString(),
      doctor: doctor
        ? { id: doctor.id, name: doctor.name, specialty: doctor.specialty, avatarUrl: doctor.avatarUrl }
        : { id: c.doctorId, name: 'Unknown doctor', specialty: '' },
    };
  }
}
