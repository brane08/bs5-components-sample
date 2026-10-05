import { AnimationCallbackEvent, ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { TOAST_POSITIONS, ToastPositionClass } from './toast.config';
import { ToastPackage } from './toast-ref';
import { ToastService } from './toast.service';

/** Bootstrap position utilities for each ngx-toastr position class. */
const POSITION_UTILITIES: Record<ToastPositionClass, string> = {
  'toast-top-right': 'top-0 end-0',
  'toast-top-left': 'top-0 start-0',
  'toast-top-center': 'top-0 start-50 translate-middle-x',
  'toast-top-full-width': 'top-0 start-0 end-0 w-100',
  'toast-bottom-right': 'bottom-0 end-0',
  'toast-bottom-left': 'bottom-0 start-0',
  'toast-bottom-center': 'bottom-0 start-50 translate-middle-x',
  'toast-bottom-full-width': 'bottom-0 start-0 end-0 w-100'
};

/** Rendered by ToastService directly under <body>; not meant to be used in templates. */
@Component({
  selector: 'app-toast-container',
  templateUrl: './toast-container.component.html',
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastContainerComponent {
  private readonly service = inject(ToastService);

  protected readonly groups = computed(() => {
    const visible = this.service.toasts().filter(t => t.toastRef.isActive());
    return TOAST_POSITIONS.map(position => ({
      position,
      classes: POSITION_UTILITIES[position],
      toasts: visible.filter(t => t.config.positionClass === position)
    }));
  });

  protected track(toast: ToastPackage) {
    return toast.toastId;
  }

  /** Fades in with Bootstrap's `.fade` + `.show`, the same way Bootstrap's own toast plugin does. */
  protected fadeIn(event: AnimationCallbackEvent, toast: ToastPackage) {
    const el = event.target as HTMLElement;
    el.style.transitionDuration = `${toast.config.easeTime}ms`;
    el.classList.add('fade');
    void el.offsetWidth; // reflow, so the transition starts from the hidden state
    el.classList.add('show');
    event.animationComplete();
  }

  /** Removes `.show` and lets Bootstrap's `.fade` transition run before the element is removed. */
  protected fadeOut(event: AnimationCallbackEvent, toast: ToastPackage) {
    const el = event.target as HTMLElement;
    // Bootstrap disables `.fade` transitions for prefers-reduced-motion.
    const animated = getComputedStyle(el).transitionProperty !== 'none';
    el.classList.remove('show');
    setTimeout(() => event.animationComplete(), animated ? toast.config.easeTime : 0);
  }
}
