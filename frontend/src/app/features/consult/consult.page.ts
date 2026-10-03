import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, viewChild } from '@angular/core';
import { ConsultStore } from './consult.store';
import { DoctorList } from './doctor-list';
import { ConsultationList } from './consultation-list';
import { BookingDrawer } from './booking-drawer';
import { Icon } from '../../shared/icon';
import { formatDateTime } from '../../core/clinic-time';

@Component({
  selector: 'hl-consult-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DoctorList, ConsultationList, BookingDrawer, Icon],
  providers: [ConsultStore],
  templateUrl: './consult.page.html',
  styleUrl: './consult.page.scss',
})
export class ConsultPage {
  protected readonly store = inject(ConsultStore);
  private readonly doctorsEl = viewChild.required(DoctorList, { read: ElementRef });
  private readonly consultationsEl = viewChild.required(ConsultationList, { read: ElementRef });

  protected readonly next = computed(() => {
    const c = this.store.nextConsultation();
    return c ? { ...c, when: formatDateTime(c.scheduledAt, this.store.now()) } : null;
  });

  constructor() {
    this.store.init();
  }

  protected scrollToDoctors(): void {
    const el = this.doctorsEl().nativeElement as HTMLElement;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true });
  }

  protected scrollToConsultations(): void {
    (this.consultationsEl().nativeElement as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
