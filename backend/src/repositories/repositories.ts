import type { Store } from '../storage/store.js';
import type { Consultation, Doctor, IdempotencyRecord, Patient } from '../domain/models.js';

export class DoctorRepository {
  constructor(private readonly store: Store) {}
  findAll(): readonly Doctor[] {
    return this.store.db.doctors;
  }
  findById(id: string): Doctor | undefined {
    return this.store.db.doctors.find((d) => d.id === id);
  }
}

export class PatientRepository {
  constructor(private readonly store: Store) {}
  findById(id: string): Patient | undefined {
    return this.store.db.patients.find((p) => p.id === id);
  }
}

export class ConsultationRepository {
  constructor(private readonly store: Store) {}

  findByPatient(patientId: string): Consultation[] {
    return this.store.db.consultations.filter((c) => c.patientId === patientId);
  }
  findByDoctor(doctorId: string): Consultation[] {
    return this.store.db.consultations.filter((c) => c.doctorId === doctorId);
  }
  findById(id: string): Consultation | undefined {
    return this.store.db.consultations.find((c) => c.id === id);
  }
  insert(c: Consultation): void {
    this.store.db.consultations.push(c);
  }
  update(id: string, patch: Partial<Consultation>): Consultation | undefined {
    const existing = this.findById(id);
    if (existing) Object.assign(existing, patch);
    return existing;
  }
  flush(): Promise<void> {
    return this.store.persist();
  }
}

export class IdempotencyRepository {
  /** Keys older than this are ignored and pruned. */
  private static readonly TTL_MS = 24 * 3600_000;
  constructor(private readonly store: Store) {}

  find(patientId: string, key: string, now: Date): IdempotencyRecord | undefined {
    return this.store.db.idempotency.find(
      (r) =>
        r.patientId === patientId &&
        r.key === key &&
        now.getTime() - Date.parse(r.createdAt) < IdempotencyRepository.TTL_MS,
    );
  }
  save(record: IdempotencyRecord, now: Date): void {
    const db = this.store.db;
    db.idempotency = db.idempotency.filter(
      (r) => now.getTime() - Date.parse(r.createdAt) < IdempotencyRepository.TTL_MS,
    );
    db.idempotency.push(record);
  }
}
