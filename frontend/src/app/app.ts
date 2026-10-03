import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeader } from './layout/app-header';
import { ToastOutlet } from './shared/toast-outlet';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AppHeader, ToastOutlet],
  template: `
    <a class="skip" href="#main-content">Skip to content</a>
    <hl-app-header />
    <div id="main-content" tabindex="-1">
      <router-outlet />
    </div>
    <hl-toast-outlet />
  `,
  styles: `
    .skip {
      position: fixed;
      top: 8px;
      left: 8px;
      z-index: 200;
      padding: 8px 14px;
      border-radius: var(--hl-radius-sm);
      background: var(--hl-ink);
      color: #fff;
      font-weight: 600;
      transform: translateY(-200%);
      transition: transform var(--hl-base) var(--hl-ease);
    }
    .skip:focus { transform: none; }
    #main-content:focus { box-shadow: none; }
  `,
})
export class App {}
