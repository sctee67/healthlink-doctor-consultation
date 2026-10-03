import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal } from '@angular/core';
import { ConsultStore } from './consult.store';
import { Icon } from '../../shared/icon';
import { formatDateTime } from '../../core/clinic-time';
import type { Consultation } from '../../core/models';

type Tab = 'upcoming' | 'past';

@Component({
  selector: 'hl-consultation-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './consultation-list.html',
  styleUrl: './consultation-list.scss',
})
export class ConsultationList {
  protected readonly store = inject(ConsultStore);
  /** Asks the page to bring the doctor list into view. */
  readonly browseDoctors = output<void>();

  protected readonly tab = signal<Tab>('upcoming');
  protected readonly expandedId = signal<string | null>(null);
  protected readonly confirmingId = signal<string | null>(null);

  protected readonly items = computed(() => (this.tab() === 'upcoming' ? this.store.upcoming() : this.store.past()));

  constructor() {
    // A fresh booking should be visible immediately, whichever tab was open.
    effect(() => {
      if (this.store.highlightId()) this.tab.set('upcoming');
    });
  }

  protected when(c: Consultation): string {
    return formatDateTime(c.scheduledAt, this.store.now());
  }

  protected bookedOn(c: Consultation): string {
    return formatDateTime(c.createdAt, this.store.now());
  }

  protected typeLabel(c: Consultation): string {
    return c.type === 'video' ? 'Video Call' : 'Chat';
  }

  protected selectTab(tab: Tab): void {
    this.tab.set(tab);
    this.expandedId.set(null);
    this.confirmingId.set(null);
  }

  protected toggle(id: string): void {
    this.expandedId.update((cur) => (cur === id ? null : id));
    this.confirmingId.set(null);
  }

  protected async confirmCancel(c: Consultation): Promise<void> {
    if (await this.store.cancel(c.id)) {
      this.confirmingId.set(null);
      this.expandedId.set(null);
    }
  }
}
