import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HealthLinkApi } from '../../core/healthlink-api';
import { ApiError, toApiError } from '../../core/api-error';
import { ToastService } from '../../core/toast.service';
import { formatDateTime } from '../../core/clinic-time';
import type { Consultation, CreateConsultationRequest, Doctor } from '../../core/models';

export type LoadState = 'loading' | 'ready' | 'error';

/**
 * Page-scoped state for the consultation feature. Components read signals and
 * call intent methods; only this class talks to the API.
 */
@Injectable()
export class ConsultStore {
  private readonly api = inject(HealthLinkApi);
  private readonly toast = inject(ToastService);

  readonly doctors = signal<Doctor[]>([]);
  readonly doctorsState = signal<LoadState>('loading');

  readonly consultations = signal<Consultation[]>([]);
  readonly consultationsState = signal<LoadState>('loading');

  /** Doctor whose booking drawer is open. */
  readonly bookingDoctor = signal<Doctor | null>(null);
  /** Most recently created booking, highlighted in the list. */
  readonly highlightId = signal<string | null>(null);
  readonly cancellingId = signal<string | null>(null);

  /** Ticks every minute so relative labels ("Today", "Available now") stay honest. */
  readonly now = signal(new Date());

  readonly upcoming = computed(() => this.consultations().filter((c) => c.status === 'scheduled'));
  readonly past = computed(() => this.consultations().filter((c) => c.status !== 'scheduled'));
  readonly nextConsultation = computed(() => this.upcoming()[0] ?? null);

  constructor() {
    const timer = setInterval(() => this.tick(), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  init(): void {
    void this.loadDoctors();
    void this.loadConsultations();
  }

  async loadDoctors(silent = false): Promise<void> {
    if (!silent) this.doctorsState.set('loading');
    try {
      this.doctors.set(await firstValueFrom(this.api.doctors()));
      this.doctorsState.set('ready');
    } catch {
      if (!silent) this.doctorsState.set('error');
    }
  }

  async loadConsultations(silent = false): Promise<void> {
    if (!silent) this.consultationsState.set('loading');
    try {
      this.consultations.set(await firstValueFrom(this.api.consultations('all')));
      this.consultationsState.set('ready');
    } catch {
      if (!silent) this.consultationsState.set('error');
    }
  }

  openBooking(doctor: Doctor): void {
    this.bookingDoctor.set(doctor);
  }

  closeBooking(): void {
    this.bookingDoctor.set(null);
  }

  /** Throws ApiError so the form can map field errors / conflicts inline. */
  async book(request: CreateConsultationRequest, idempotencyKey: string): Promise<Consultation> {
    const created = await firstValueFrom(this.api.createConsultation(request, idempotencyKey));
    this.consultations.update((list) => [created, ...list.filter((c) => c.id !== created.id)].sort(byUpcomingFirst));
    this.flashHighlight(created.id);
    this.toast.success('Consultation booked', `${created.doctor.name} · ${formatDateTime(created.scheduledAt)}`);
    // Doctor availability depends on bookings — refresh quietly in the background.
    void this.loadDoctors(true);
    return created;
  }

  async cancel(id: string): Promise<boolean> {
    this.cancellingId.set(id);
    try {
      const updated = await firstValueFrom(this.api.cancelConsultation(id));
      this.consultations.update((list) => list.map((c) => (c.id === id ? updated : c)).sort(byUpcomingFirst));
      this.toast.show('info', 'Consultation cancelled', `Your slot with ${updated.doctor.name} has been released.`);
      void this.loadDoctors(true);
      return true;
    } catch (err) {
      const e: ApiError = toApiError(err);
      this.toast.error('Could not cancel', e.message);
      if (e.code === 'NOT_CANCELLABLE') void this.loadConsultations(true);
      return false;
    } finally {
      this.cancellingId.set(null);
    }
  }

  private flashHighlight(id: string): void {
    this.highlightId.set(id);
    setTimeout(() => this.highlightId.update((cur) => (cur === id ? null : cur)), 2600);
  }

  private tick(): void {
    this.now.set(new Date());
    // Availability shifts with the clock (e.g. clinic closing), so refresh it quietly.
    void this.loadDoctors(true);
    // If a session has ended since we last fetched, pick up its new status.
    if (this.upcoming().some((c) => Date.parse(c.endsAt) <= this.now().getTime())) {
      void this.loadConsultations(true);
    }
  }
}

function byUpcomingFirst(a: Consultation, b: Consultation): number {
  const au = a.status === 'scheduled';
  const bu = b.status === 'scheduled';
  if (au !== bu) return au ? -1 : 1;
  const diff = Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt);
  return au ? diff : -diff;
}
