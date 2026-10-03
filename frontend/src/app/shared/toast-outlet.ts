import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { Icon } from './icon';

@Component({
  selector: 'hl-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="stack" role="region" aria-label="Notifications" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div class="toast" [class]="'toast--' + t.kind" animate.enter="toast-in" animate.leave="toast-out" role="status">
          <span class="badge">
            <hl-icon [name]="t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'" [size]="16" [stroke]="2.4" />
          </span>
          <div class="body">
            <strong>{{ t.title }}</strong>
            @if (t.message) {
              <p>{{ t.message }}</p>
            }
          </div>
          <button type="button" class="hl-icon-btn close" (click)="toasts.dismiss(t.id)" aria-label="Dismiss notification">
            <hl-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack {
      position: fixed;
      z-index: 100;
      right: 20px;
      bottom: calc(20px + env(safe-area-inset-bottom, 0px));
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: min(380px, calc(100vw - 32px));
      pointer-events: none;
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 10px 14px 14px;
      background: var(--hl-surface);
      border: 1px solid var(--hl-line);
      border-left: 4px solid var(--_c);
      border-radius: var(--hl-radius);
      box-shadow: var(--hl-shadow-lg);
      pointer-events: auto;
    }
    .toast--success { --_c: var(--hl-success); --_bg: var(--hl-success-soft); }
    .toast--error { --_c: var(--hl-danger); --_bg: var(--hl-danger-soft); }
    .toast--info { --_c: var(--hl-primary); --_bg: var(--hl-primary-soft); }
    .badge {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--_bg);
      color: var(--_c);
      flex: none;
    }
    .body { flex: 1; min-width: 0; padding-top: 3px; }
    strong { font-size: 14px; font-weight: 600; }
    p { margin-top: 2px; color: var(--hl-muted); font-size: 13px; }
    .close { width: 28px; height: 28px; }
    .toast-in { animation: toast-in var(--hl-slow) var(--hl-spring) both; }
    .toast-out { animation: toast-out var(--hl-base) var(--hl-ease-in) both; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(16px) scale(0.96); } }
    @keyframes toast-out { to { opacity: 0; transform: translateX(24px); } }
    @media (max-width: 600px) {
      .stack { right: 16px; left: 16px; width: auto; top: calc(12px + env(safe-area-inset-top, 0px)); bottom: auto; }
    }
  `,
})
export class ToastOutlet {
  protected readonly toasts = inject(ToastService);
}
