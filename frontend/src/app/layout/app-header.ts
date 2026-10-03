import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionService } from '../core/session.service';
import { Icon } from '../shared/icon';
import { Avatar } from '../shared/avatar';

@Component({
  selector: 'hl-app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon, Avatar],
  template: `
    <header class="bar">
      <div class="inner">
        <a routerLink="/" class="brand" aria-label="HealthLink home">
          <img src="favicon.svg" alt="" width="28" height="28" />
          <span>HealthLink</span>
        </a>

        <nav aria-label="Primary">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
            <hl-icon name="home" [size]="16" /> Home
          </a>
        </nav>

        <div class="user">
          <hl-avatar [name]="session.patient()?.name ?? 'Patient'" [size]="34" />
          <span class="who">
            <strong>{{ session.firstName() }}</strong>
            <small>Patient</small>
          </span>
          <hl-icon name="chevron-down" [size]="16" class="caret" />
        </div>
      </div>
    </header>
  `,
  styles: `
    .bar {
      position: sticky;
      top: 0;
      z-index: 40;
      padding-top: env(safe-area-inset-top, 0px);
      background: rgb(255 255 255 / 0.85);
      backdrop-filter: saturate(180%) blur(12px);
      border-bottom: 1px solid var(--hl-line);
    }
    .inner {
      display: flex;
      align-items: center;
      gap: 32px;
      max-width: 1240px;
      height: var(--hl-header-h);
      margin: 0 auto;
      padding: 0 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--hl-ink);
      font-weight: 700;
      font-size: 18px;
      letter-spacing: -0.02em;
      text-decoration: none;
      border-radius: var(--hl-radius-sm);
      transition: transform var(--hl-base) var(--hl-spring);
    }
    .brand:hover { transform: scale(1.03); }
    nav { display: flex; align-self: stretch; }
    nav a {
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 4px;
      color: var(--hl-muted);
      font-weight: 600;
      font-size: 13px;
      text-decoration: none;
      transition: color var(--hl-fast);
    }
    nav a::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      border-radius: 2px;
      background: var(--hl-primary);
      transform: scaleX(0);
      transition: transform var(--hl-base) var(--hl-ease);
    }
    nav a:hover, nav a.active { color: var(--hl-primary); }
    nav a.active::after { transform: scaleX(1); }
    .user {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
      padding: 4px 8px 4px 4px;
      border-radius: var(--hl-radius-pill);
    }
    .who { display: flex; flex-direction: column; line-height: 1.2; }
    .who strong { font-size: 13px; }
    .who small { color: var(--hl-muted); font-size: 11px; }
    .caret { color: var(--hl-subtle); }
    @media (max-width: 600px) {
      .inner { gap: 16px; padding: 0 16px; }
      .who, .caret { display: none; }
    }
  `,
})
export class AppHeader {
  protected readonly session = inject(SessionService);
}
