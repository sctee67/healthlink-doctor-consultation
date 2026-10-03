import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ConsultStore } from './consult.store';
import { apiErrorInterceptor, ApiError } from '../../core/api-error';
import type { Consultation, Doctor } from '../../core/models';

const doctor = (id: string, status: Doctor['availability']['status']): Doctor => ({
  id,
  name: `Dr. ${id}`,
  specialty: 'General Practitioner',
  bio: '',
  languages: ['English'],
  yearsOfExperience: 5,
  rating: 4.8,
  consultationTypes: ['chat', 'video'],
  feeMyr: 25,
  hours: { days: [0, 1, 2, 3, 4, 5, 6], start: '09:00', end: '22:00' },
  availability: { status, nextAvailableAt: null, todayHours: null },
});

const consultation = (id: string, scheduledAt: string, status: Consultation['status'] = 'scheduled'): Consultation => ({
  id,
  doctorId: 'a',
  type: 'chat',
  scheduledAt,
  endsAt: scheduledAt,
  durationMinutes: 30,
  reason: 'Fever and sore throat',
  status,
  createdAt: '2026-09-01T00:00:00Z',
  doctor: { id: 'a', name: 'Dr. a', specialty: 'General Practitioner' },
});

describe('ConsultStore', () => {
  let store: ConsultStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConsultStore, provideHttpClient(withInterceptors([apiErrorInterceptor])), provideHttpClientTesting()],
    });
    store = TestBed.inject(ConsultStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads doctors and consultations, splitting upcoming from past', async () => {
    store.init();
    http.expectOne('/api/doctors').flush({ data: [doctor('a', 'available_now')] });
    http.expectOne('/api/consultations?scope=all').flush({
      data: [consultation('c1', '2030-01-01T01:00:00Z'), consultation('c2', '2020-01-01T01:00:00Z', 'completed')],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(store.doctorsState()).toBe('ready');
    expect(store.consultationsState()).toBe('ready');
    expect(store.upcoming().map((c) => c.id)).toEqual(['c1']);
    expect(store.past().map((c) => c.id)).toEqual(['c2']);
    expect(store.nextConsultation()?.id).toBe('c1');
  });

  it('flags an error state when doctors fail to load', async () => {
    const done = store.loadDoctors();
    http.expectOne('/api/doctors').flush(null, { status: 0, statusText: 'Unknown Error' });
    await done;
    expect(store.doctorsState()).toBe('error');
  });

  it('books with an idempotency key and inserts the new consultation in order', async () => {
    store.consultations.set([consultation('later', '2030-06-01T01:00:00Z')]);
    const booking = store.book(
      { doctorId: 'a', type: 'chat', scheduledAt: '2030-01-01T01:00:00Z', reason: 'Fever and sore throat' },
      'key-123',
    );
    const req = http.expectOne('/api/consultations');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('key-123');
    req.flush({ data: consultation('new', '2030-01-01T01:00:00Z') }, { status: 201, statusText: 'Created' });

    const created = await booking;
    expect(created.id).toBe('new');
    expect(store.consultations().map((c) => c.id)).toEqual(['new', 'later']);
    expect(store.highlightId()).toBe('new');
    // Availability is refreshed in the background after booking.
    http.expectOne('/api/doctors').flush({ data: [] });
  });

  it('surfaces API problem details as ApiError on a slot conflict', async () => {
    const booking = store.book(
      { doctorId: 'a', type: 'chat', scheduledAt: '2030-01-01T01:00:00Z', reason: 'Fever and sore throat' },
      'key-456',
    );
    http
      .expectOne('/api/consultations')
      .flush(
        { title: 'That time was just booked.', status: 409, code: 'SLOT_TAKEN' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(booking).rejects.toBeInstanceOf(ApiError);
    await booking.catch((e: ApiError) => expect(e.code).toBe('SLOT_TAKEN'));
    expect(store.consultations()).toEqual([]);
  });
});
