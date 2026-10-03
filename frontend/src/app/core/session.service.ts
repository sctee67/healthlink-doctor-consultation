import { Injectable, computed, inject, signal } from '@angular/core';
import { HealthLinkApi } from './healthlink-api';
import type { Patient } from './models';

/** Who is signed in. Today this is the API's demo patient; a real auth flow would plug in here. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(HealthLinkApi);
  readonly patient = signal<Patient | null>(null);
  readonly firstName = computed(() => this.patient()?.name.split(' ')[0] ?? 'Patient');

  constructor() {
    this.api.me().subscribe({
      next: (p) => this.patient.set(p),
      error: () => undefined, // Non-critical: header falls back to a generic label.
    });
  }
}
