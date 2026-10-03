import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const PALETTES: [string, string][] = [
  ['#0b5ed7', '#14b8a6'],
  ['#6d4bd8', '#0b5ed7'],
  ['#0ea5a4', '#22c55e'],
  ['#db2777', '#f97316'],
  ['#0f766e', '#0b5ed7'],
  ['#7c3aed', '#db2777'],
];

/** Photo avatar with a deterministic gradient-initials fallback. */
@Component({
  selector: 'hl-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'name()',
    '[style.--size.px]': 'size()',
    '[style.background]': 'gradient()',
  },
  template: `
    @if (src()) {
      <img [src]="src()" alt="" loading="lazy" />
    } @else {
      <span>{{ initials() }}</span>
    }
    @if (online()) {
      <i class="dot" aria-hidden="true"></i>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-grid;
      place-items: center;
      flex: none;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      color: #fff;
      font-weight: 600;
      font-size: calc(var(--size) * 0.36);
      letter-spacing: 0.02em;
      box-shadow: inset 0 0 0 2px rgb(255 255 255 / 0.5), 0 2px 8px rgb(15 31 61 / 0.12);
    }
    img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .dot {
      position: absolute;
      right: 2%;
      bottom: 2%;
      width: 26%;
      height: 26%;
      border-radius: 50%;
      background: var(--hl-success);
      border: 2px solid #fff;
    }
    .dot::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 50%;
      border: 2px solid var(--hl-success);
      animation: pulse 2s ease-out infinite;
    }
    @keyframes pulse {
      from { transform: scale(1); opacity: 0.7; }
      to { transform: scale(2.2); opacity: 0; }
    }
  `,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly src = input<string | undefined>();
  readonly size = input(48);
  readonly online = input(false);

  protected readonly initials = computed(() =>
    this.name()
      .replace(/^dr\.?\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join(''),
  );

  protected readonly gradient = computed(() => {
    let hash = 0;
    for (const ch of this.name()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const [a, b] = PALETTES[hash % PALETTES.length]!;
    return `linear-gradient(135deg, ${a}, ${b})`;
  });
}
