import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { closeButtonTheme } from '../util/bs-theme';
import { ToastPackage } from './toast-ref';

/** Default toast: Bootstrap 5 `.toast` markup. Swap via the `toastComponent` option. */
@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass',
    '[attr.role]': 'role',
    '[attr.aria-live]': "role === 'alert' ? 'assertive' : 'polite'",
    'aria-atomic': 'true',
    '(mouseenter)': 'setHover(true)',
    '(mouseleave)': 'setHover(false)',
    '(focusin)': 'setFocus(true)',
    '(focusout)': 'setFocus(false)',
    '(keydown.escape)': 'ref.manualClose()',
    '(click)': 'ref.tap()'
  }
})
export class BsToastComponent {
  protected readonly pkg = inject(ToastPackage);
  protected readonly ref = this.pkg.toastRef;
  protected readonly config = this.pkg.config;

  protected readonly hostClass = [
    this.config.toastClass, 'show', 'd-block', 'overflow-hidden',
    this.config.positionClass.endsWith('full-width') ? 'w-100' : '',
    this.pkg.typeClass, this.pkg.typeClass ? 'border-0' : ''
  ].filter(Boolean).join(' ');
  protected readonly role = this.pkg.toastType === 'error' || this.pkg.toastType === 'warning' ? 'alert' : 'status';
  /** Without a header the close button sits on the colored body. */
  protected readonly bodyCloseTheme = closeButtonTheme(this.pkg.typeClass);
  protected readonly duplicates = computed(() => this.ref.duplicatesCount());
  private hovered = false;
  private focused = false;

  /** Hover and keyboard focus both keep the toast open (WCAG 2.2.1 Timing Adjustable). */
  protected setHover(hovered: boolean) {
    this.hovered = hovered;
    this.updatePause();
  }

  protected setFocus(focused: boolean) {
    this.focused = focused;
    this.updatePause();
  }

  private updatePause() {
    if (this.hovered || this.focused) {
      this.ref.pause();
    } else {
      this.ref.resume();
    }
  }

  close(event: Event) {
    event.stopPropagation();
    this.ref.manualClose();
  }
}
