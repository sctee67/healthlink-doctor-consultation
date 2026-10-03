import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ConsultStore } from './consult.store';
import { Icon } from '../../shared/icon';
import { Avatar } from '../../shared/avatar';
import { formatDateTime } from '../../core/clinic-time';
import type { Doctor } from '../../core/models';

@Component({
  selector: 'hl-doctor-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Avatar],
  templateUrl: './doctor-list.html',
  styleUrl: './doctor-list.scss',
})
export class DoctorList {
  protected readonly store = inject(ConsultStore);

  protected readonly query = signal('');
  protected readonly specialty = signal<string | null>(null);

  protected readonly specialties = computed(() =>
    [...new Set(this.store.doctors().map((d) => d.specialty))].sort(),
  );

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const s = this.specialty();
    return this.store
      .doctors()
      .filter((d) => !s || d.specialty === s)
      .filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.specialty.toLowerCase().includes(q) ||
          d.languages.some((l) => l.toLowerCase().includes(q)),
      )
      // Doctors you can see right now first.
      .sort((a, b) => rank(a) - rank(b));
  });

  protected readonly isFiltering = computed(() => !!this.query() || !!this.specialty());

  protected availabilityLabel(d: Doctor): string {
    const a = d.availability;
    if (a.status === 'available_now') return 'Available now';
    if (a.nextAvailableAt) return `Next: ${formatDateTime(a.nextAvailableAt, this.store.now())}`;
    return 'Fully booked';
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.specialty.set(null);
  }
}

function rank(d: Doctor): number {
  return { available_now: 0, available_later: 1, unavailable: 2 }[d.availability.status];
}
