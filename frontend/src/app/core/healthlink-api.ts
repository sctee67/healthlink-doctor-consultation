import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type {
  ApiEnvelope,
  Consultation,
  ConsultationScope,
  CreateConsultationRequest,
  Doctor,
  Patient,
  Slot,
} from './models';

/** Base URL for the API; defaults to same-origin `/api` (proxied in dev). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});

@Injectable({ providedIn: 'root' })
export class HealthLinkApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  me(): Observable<Patient> {
    return this.get<Patient>('/me');
  }

  doctors(): Observable<Doctor[]> {
    return this.get<Doctor[]>('/doctors');
  }

  slots(doctorId: string, date: string): Observable<Slot[]> {
    return this.get<{ date: string; slots: Slot[] }>(
      `/doctors/${encodeURIComponent(doctorId)}/slots`,
      new HttpParams().set('date', date),
    ).pipe(map((r) => r.slots));
  }

  consultations(scope: ConsultationScope = 'all'): Observable<Consultation[]> {
    return this.get<Consultation[]>('/consultations', new HttpParams().set('scope', scope));
  }

  /** `idempotencyKey` makes retries of the same submission safe. */
  createConsultation(body: CreateConsultationRequest, idempotencyKey: string): Observable<Consultation> {
    return this.http
      .post<ApiEnvelope<Consultation>>(`${this.base}/consultations`, body, {
        headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
      })
      .pipe(map((r) => r.data));
  }

  cancelConsultation(id: string): Observable<Consultation> {
    return this.http
      .post<ApiEnvelope<Consultation>>(`${this.base}/consultations/${encodeURIComponent(id)}/cancel`, {})
      .pipe(map((r) => r.data));
  }

  private get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.http.get<ApiEnvelope<T>>(`${this.base}${path}`, { params }).pipe(map((r) => r.data));
  }
}
