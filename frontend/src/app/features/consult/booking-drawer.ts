import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  type OnDestroy,
  type OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { type AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, type ValidationErrors, Validators } from '@angular/forms';
import { of } from 'rxjs';
import { ConsultStore } from './consult.store';
import { HealthLinkApi } from '../../core/healthlink-api';
import { toApiError } from '../../core/api-error';
import {
  BOOKING_WINDOW_DAYS,
  addDays,
  clinicDate,
  clinicHour,
  dayChipLabel,
  formatDateTime,
  formatHm,
  formatTime,
} from '../../core/clinic-time';
import { REASON_MAX, REASON_MIN, type Consultation, type ConsultationType, type Doctor, type Slot } from '../../core/models';
import { Icon, type IconName } from '../../shared/icon';
import { Avatar } from '../../shared/avatar';

type Phase = 'form' | 'submitting' | 'success';

/** Rejects input that only meets the length requirement because of surrounding spaces. */
function trimmedMinLength(min: number) {
  return (c: AbstractControl<string>): ValidationErrors | null =>
    c.value && c.value.trim().length < min ? { minlength: { requiredLength: min } } : null;
}

const SLOT_CONFLICT_CODES = new Set(['SLOT_TAKEN', 'SLOT_IN_PAST', 'OUTSIDE_DOCTOR_HOURS', 'INVALID_SLOT', 'PATIENT_DOUBLE_BOOKED']);

@Component({
  selector: 'hl-booking-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, Avatar],
  templateUrl: './booking-drawer.html',
  styleUrl: './booking-drawer.scss',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class BookingDrawer implements OnInit, OnDestroy {
  readonly doctor = input.required<Doctor>();
  readonly closed = output<void>();

  protected readonly store = inject(ConsultStore);
  private readonly api = inject(HealthLinkApi);
  private readonly document = inject(DOCUMENT);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  protected readonly reasonMax = REASON_MAX;
  protected readonly typeOptions: ConsultationType[] = ['chat', 'video'];

  protected readonly form = this.fb.group({
    type: this.fb.control<ConsultationType>('chat', Validators.required),
    slot: this.fb.control('', Validators.required),
    reason: this.fb.control('', [Validators.required, trimmedMinLength(REASON_MIN), Validators.maxLength(REASON_MAX)]),
  });

  protected readonly phase = signal<Phase>('form');
  protected readonly created = signal<Consultation | null>(null);
  protected readonly date = signal('');
  protected readonly slotError = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly submitAttempted = signal(false);

  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly reasonLength = computed(() => (this.value().reason ?? '').length);

  /** One key per booking attempt: retries after a network blip can never double-book. */
  private idempotencyKey = crypto.randomUUID();
  private returnFocusTo: HTMLElement | null = null;

  protected readonly slots = rxResource<Slot[], { doctorId: string; date: string } | undefined>({
    params: () => (this.date() ? { doctorId: this.doctor().id, date: this.date() } : undefined),
    stream: ({ params }) => (params ? this.api.slots(params.doctorId, params.date) : of([])),
    defaultValue: [],
  });

  protected readonly days = computed(() => {
    const today = clinicDate(this.store.now());
    const works = new Set(this.doctor().hours.days);
    return Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => {
      const date = addDays(today, i);
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      return { date, ...dayChipLabel(date, this.store.now()), works: works.has(weekday) };
    });
  });

  /** Future slots grouped by part of day; past slots are hidden to reduce noise. */
  protected readonly slotGroups = computed(() => {
    const groups: { label: string; icon: IconName; slots: Slot[] }[] = [
      { label: 'Morning', icon: 'sun', slots: [] },
      { label: 'Afternoon', icon: 'sunset', slots: [] },
      { label: 'Evening', icon: 'moon', slots: [] },
    ];
    for (const s of this.slots.value()) {
      if (s.reason === 'past') continue;
      const h = clinicHour(s.startsAt);
      groups[h < 12 ? 0 : h < 17 ? 1 : 2]!.slots.push(s);
    }
    return groups.filter((g) => g.slots.length);
  });

  protected readonly hasFreeSlot = computed(() => this.slots.value().some((s) => s.available));
  protected readonly selectedLabel = computed(() => {
    const slot = this.value().slot;
    return slot ? formatDateTime(slot, this.store.now()) : null;
  });

  protected readonly stepDone = computed(() => {
    const v = this.value();
    return {
      type: !!v.type,
      time: !!v.slot,
      reason: (v.reason ?? '').trim().length >= REASON_MIN && (v.reason ?? '').length <= REASON_MAX,
    };
  });

  protected readonly hoursLabel = computed(() => {
    const h = this.doctor().hours;
    return `${formatHm(h.start)} – ${formatHm(h.end)}`;
  });

  protected readonly formatTime = formatTime;
  protected readonly formatDateTime = (iso: string) => formatDateTime(iso, this.store.now());

  constructor() {
    afterNextRender(() => {
      this.panel().nativeElement.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    });
  }

  ngOnInit(): void {
    const doctor = this.doctor();
    this.returnFocusTo = this.document.activeElement as HTMLElement | null;
    this.document.body.style.overflow = 'hidden';

    this.form.controls.type.setValue(doctor.consultationTypes.includes('chat') ? 'chat' : 'video');
    const next = doctor.availability.nextAvailableAt;
    this.date.set(next ? clinicDate(next) : clinicDate(this.store.now()));
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow = '';
    this.returnFocusTo?.focus?.({ preventScroll: true });
  }

  protected selectDate(date: string): void {
    if (date === this.date()) return;
    this.date.set(date);
    this.form.controls.slot.setValue('');
    this.slotError.set(null);
  }

  // Radios are bound natively (not via formControlName) so per-option `disabled` stays in our hands.
  protected pickType(type: ConsultationType): void {
    this.form.controls.type.setValue(type);
  }

  protected pickSlot(startsAt: string): void {
    this.form.controls.slot.setValue(startsAt);
    this.form.controls.slot.markAsTouched();
    this.slotError.set(null);
  }

  protected jumpToNextAvailable(): void {
    const next = this.days().find((d) => d.works && d.date > this.date());
    if (next) this.selectDate(next.date);
  }

  protected isOffered(type: ConsultationType): boolean {
    return this.doctor().consultationTypes.includes(type);
  }

  protected showError(name: 'slot' | 'reason'): boolean {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || this.submitAttempted());
  }

  protected reasonError(): string {
    const e = this.form.controls.reason.errors;
    if (!e) return '';
    if (e['server']) return e['server'] as string;
    if (e['required']) return 'Please tell the doctor why you are booking.';
    if (e['minlength']) return `Please add a little more detail (at least ${REASON_MIN} characters).`;
    if (e['maxlength']) return `Please keep it under ${REASON_MAX} characters.`;
    return '';
  }

  protected async submit(): Promise<void> {
    if (this.phase() !== 'form') return;
    this.submitAttempted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    const { type, slot, reason } = this.form.getRawValue();
    this.phase.set('submitting');
    try {
      const created = await this.store.book(
        { doctorId: this.doctor().id, type, scheduledAt: slot, reason: reason.trim() },
        this.idempotencyKey,
      );
      this.created.set(created);
      this.phase.set('success');
      queueMicrotask(() => this.panel().nativeElement.querySelector<HTMLElement>('[data-success-focus]')?.focus());
    } catch (err) {
      this.phase.set('form');
      const e = toApiError(err);
      if (SLOT_CONFLICT_CODES.has(e.code)) {
        this.slotError.set(e.message);
        this.form.controls.slot.setValue('');
        this.slots.reload();
      } else if (e.code === 'VALIDATION_FAILED' && e.fieldErrors.length) {
        for (const fe of e.fieldErrors) {
          const ctrl = this.form.get(fe.field === 'scheduledAt' ? 'slot' : fe.field);
          ctrl?.setErrors({ server: fe.message });
          ctrl?.markAsTouched();
        }
      } else {
        this.formError.set(e.isNetwork ? e.message : `${e.message}${e.requestId ? ` (ref: ${e.requestId.slice(0, 8)})` : ''}`);
      }
    }
  }

  protected close(): void {
    if (this.phase() === 'submitting') return;
    this.closed.emit();
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    // Keep keyboard focus inside the dialog.
    const focusables = Array.from(
      this.panel().nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]):not([type="radio"]), input[type="radio"]:checked:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    const first = focusables[0];
    const last = focusables.at(-1);
    if (!first || !last) return;
    const active = this.document.activeElement;
    if (e.shiftKey && (active === first || !this.panel().nativeElement.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  private focusFirstInvalid(): void {
    const el = this.panel().nativeElement.querySelector<HTMLElement>(
      this.form.controls.slot.invalid ? '#time-step' : '#reason-input',
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
  }
}
