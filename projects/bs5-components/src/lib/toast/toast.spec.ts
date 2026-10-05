import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_TOAST_CONFIG,
  GlobalConfig,
  provideToastr,
} from './toast.config';
import { ToastPackage } from './toast-ref';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-custom-toast',
  template: `<div class="custom">{{ pkg.message }}</div>
    <button class="act" (click)="pkg.triggerAction('undo')">Undo</button>
    <button class="tap" (click)="pkg.triggerTap()">Tap</button>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class CustomToastComponent {
  readonly pkg = inject(ToastPackage);
}

describe('Toast', () => {
  let service: ToastService;

  const toasts = () =>
    Array.from(document.querySelectorAll<HTMLElement>('app-toast'));
  // Renders, flushes zero-delay timers (leave animations with easeTime 0) and lets Angular finish removals,
  // which it completes in a promise callback after `animationComplete()`.
  const render = async () => {
    TestBed.tick();
    vi.advanceTimersByTime(0);
    await Promise.resolve();
    await Promise.resolve();
    TestBed.tick();
  };
  const tick = async (ms: number) => {
    vi.advanceTimersByTime(ms);
    await render();
  };

  function setup(config?: Partial<GlobalConfig>) {
    // Animations on, as in the app, so the Bootstrap fade handlers run.
    TestBed.configureTestingModule({
      animationsEnabled: true,
      providers: config ? [provideToastr(config)] : [],
    });
    service = TestBed.inject(ToastService);
    service.config.easeTime = 0;
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  describe('configuration', () => {
    it('uses defaults without provideToastr and merges provided config', async () => {
      TestBed.configureTestingModule({});
      expect(TestBed.inject(ToastService).config).toEqual(DEFAULT_TOAST_CONFIG);
      TestBed.resetTestingModule();
      setup({ timeOut: 1 });
      expect(service.config.timeOut).toBe(1);
    });

    it('provideToastr defaults to an empty config', async () => {
      TestBed.configureTestingModule({ providers: [provideToastr()] });
      expect(TestBed.inject(ToastService).config).toEqual(DEFAULT_TOAST_CONFIG);
    });
  });

  describe('rendering', () => {
    beforeEach(() => setup());

    it('attaches one container to the body with Bootstrap position utilities', async () => {
      service.success('a');
      service.info('b', undefined, {
        positionClass: 'toast-bottom-full-width',
      });
      await render();
      expect(document.querySelectorAll('app-toast-container').length).toBe(1);
      const topRight = document.querySelector(
        '[data-position="toast-top-right"]',
      )!;
      expect(topRight.classList).toContain('toast-container');
      expect(topRight.classList).toContain('top-0');
      expect(topRight.classList).toContain('end-0');
      expect(topRight.querySelectorAll('app-toast').length).toBe(1);
      const full = document.querySelector(
        '[data-position="toast-bottom-full-width"]',
      )!;
      expect(full.classList).toContain('w-100');
      expect(full.querySelector('app-toast')!.classList).toContain('w-100');
      expect(topRight.querySelector('app-toast')!.classList).not.toContain(
        'w-100',
      );
    });

    it('maps types to Bootstrap color classes and roles', async () => {
      service.success('s');
      service.error('e');
      service.info('i');
      service.warning('w');
      await render();
      const byText = (t: string) =>
        toasts().find((x) => x.textContent!.includes(t))!;
      expect(byText('s').classList).toContain('text-bg-success');
      expect(byText('s').classList).toContain('border-0');
      expect(byText('s').getAttribute('role')).toBe('status');
      expect(byText('s').getAttribute('aria-live')).toBe('polite');
      expect(byText('e').classList).toContain('text-bg-danger');
      expect(byText('e').getAttribute('role')).toBe('alert');
      expect(byText('e').getAttribute('aria-live')).toBe('assertive');
      expect(byText('w').getAttribute('role')).toBe('alert');
      expect(byText('i').classList).toContain('text-bg-info');
    });

    it('show() without arguments renders a plain toast', async () => {
      const active = service.show();
      await render();
      expect(active.message).toBeUndefined();
      expect(Array.from(toasts()[0].classList).sort()).toEqual([
        'd-block',
        'overflow-hidden',
        'show',
        'toast',
      ]);
    });

    it('renders a header with title, close button and closes on click', async () => {
      const hidden = vi.fn();
      const active = service.success('body', 'Title', { closeButton: true });
      active.onHidden.subscribe(hidden);
      await render();
      const toast = toasts()[0];
      expect(toast.querySelector('.toast-header strong')!.textContent).toBe(
        'Title',
      );
      expect(toast.querySelector('.toast-header strong')!.className).toBe(
        'me-auto',
      );
      expect(toast.querySelector('.toast-body')!.textContent).toContain('body');
      toast
        .querySelector<HTMLButtonElement>('.toast-header .btn-close')!
        .click();
      await render();
      expect(toasts().length).toBe(0);
      expect(hidden).toHaveBeenCalled();
    });

    it('puts the close button in the body when there is no title, themed for dark backgrounds', async () => {
      service.success('dark', undefined, { closeButton: true });
      service.warning('light', undefined, { closeButton: true });
      await render();
      const [first, second] = toasts().map(
        (t) => t.querySelector('.d-flex > .btn-close')!,
      );
      const themes = [first, second]
        .map((b) => b.getAttribute('data-bs-theme'))
        .sort();
      expect(themes).toEqual(['dark', null as unknown as string].sort());
    });

    it('renders HTML when enableHtml is set', async () => {
      service.info('<b>bold</b>', '<i>it</i>', { enableHtml: true });
      service.info('<b>raw</b>', undefined, { enableHtml: true });
      await render();
      expect(document.querySelectorAll('app-toast b').length).toBe(2);
      expect(
        document.querySelector('app-toast .toast-header i')!.textContent,
      ).toBe('it');
    });

    it('renders a custom toast component with access to the package', async () => {
      const action = vi.fn();
      const tap = vi.fn();
      const active = service.show('custom', undefined, {
        toastComponent: CustomToastComponent,
      });
      active.onAction.subscribe(action);
      active.onTap.subscribe(tap);
      await render();
      expect(
        document.querySelector('app-custom-toast .custom')!.textContent,
      ).toBe('custom');
      document
        .querySelector<HTMLButtonElement>('app-custom-toast .act')!
        .click();
      expect(action).toHaveBeenCalledWith('undo');
      document
        .querySelector<HTMLButtonElement>('app-custom-toast .tap')!
        .click();
      expect(tap).toHaveBeenCalled();
    });

    it('spaces stacked toasts with Bootstrap margin utilities', async () => {
      service.info('a');
      service.info('b');
      await render();
      const slots = Array.from(document.querySelectorAll('.toast-slot'));
      expect(slots.map((s) => s.classList.contains('mb-4'))).toEqual([
        true,
        false,
      ]);
    });

    it('fades in and out with Bootstrap .fade/.show using easeTime', async () => {
      service.config.easeTime = 200;
      const { toastRef } = service.info('x');
      await render();
      const slot = document.querySelector<HTMLElement>('.toast-slot')!;
      expect(slot.classList).toContain('fade');
      expect(slot.classList).toContain('show');
      expect(slot.style.transitionDuration).toBe('200ms');
      toastRef.close();
      await render();
      expect(slot.classList).not.toContain('show');
      expect(toasts().length).toBe(1);
      await tick(200);
      expect(toasts().length).toBe(0);
    });

    it('removes immediately when transitions are disabled (prefers-reduced-motion)', async () => {
      service.config.easeTime = 200;
      const { toastRef } = service.info('x');
      await render();
      const real = window.getComputedStyle.bind(window);
      vi.spyOn(window, 'getComputedStyle').mockImplementation(
        (el: Element) =>
          ({ ...real(el), transitionProperty: 'none' }) as CSSStyleDeclaration,
      );
      toastRef.close();
      await render();
      expect(toasts().length).toBe(0);
    });

    it('applies newestOnTop when a toast is inserted, without reordering open toasts', async () => {
      service.info('first');
      service.info('second');
      await render();
      expect(toasts().map((t) => t.textContent!.trim())).toEqual([
        'second',
        'first',
      ]);
      service.config.newestOnTop = false;
      service.info('third');
      await render();
      expect(toasts().map((t) => t.textContent!.trim())).toEqual([
        'second',
        'first',
        'third',
      ]);
    });

    it('pauses while hovered or focused and closes on Escape', async () => {
      const { toastRef } = service.info('x', 'T', {
        timeOut: 1000,
        extendedTimeOut: 100,
        closeButton: true,
      });
      await render();
      const toast = toasts()[0];
      toast.dispatchEvent(new MouseEvent('mouseenter'));
      toast.dispatchEvent(new FocusEvent('focusin'));
      toast.dispatchEvent(new MouseEvent('mouseleave'));
      await tick(5000);
      expect(toastRef.isClosed()).toBe(false);
      toast.dispatchEvent(new FocusEvent('focusout'));
      await tick(100);
      expect(toastRef.isClosed()).toBe(true);
      const second = service.info('y');
      await render();
      toasts()[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape' }),
      );
      expect(second.toastRef.isClosed()).toBe(true);
    });

    it('uses configurable labels and hides the progress bar from screen readers', async () => {
      service.config.closeLabel = 'Schließen';
      service.config.duplicatesLabel = 'Wiederholt';
      service.config.preventDuplicates = true;
      service.config.countDuplicates = true;
      service.info('x', undefined, { closeButton: true, progressBar: true });
      service.info('x');
      await render();
      const toast = toasts()[0];
      expect(
        toast.querySelector('.btn-close')!.getAttribute('aria-label'),
      ).toBe('Schließen');
      expect(toast.querySelector('.badge')!.getAttribute('aria-label')).toBe(
        'Wiederholt',
      );
      expect(
        toast.querySelector('.progress')!.getAttribute('aria-hidden'),
      ).toBe('true');
      expect(toast.querySelector('[role=progressbar]')).toBeNull();
    });

    it('emits onShown after the toast is rendered', async () => {
      const shown = vi.fn();
      service.info('x').onShown.subscribe(shown);
      expect(shown).not.toHaveBeenCalled();
      await render();
      expect(shown).toHaveBeenCalled();
    });

    it('removes the container when the injector is destroyed', async () => {
      service.info('x');
      await render();
      expect(document.querySelector('app-toast-container')).not.toBeNull();
      TestBed.resetTestingModule();
      expect(document.querySelector('app-toast-container')).toBeNull();
    });
  });

  describe('timers', () => {
    beforeEach(() => setup());

    it('auto-dismisses after timeOut with a progress bar', async () => {
      service.info('x', undefined, { timeOut: 1000, progressBar: true });
      await render();
      const bar = toasts()[0].querySelector<HTMLElement>('.progress-bar')!;
      expect(bar.classList).toContain('toast-progress-decreasing');
      expect(bar.style.animationDuration).toBe('1000ms');
      await tick(999);
      expect(toasts().length).toBe(1);
      await tick(1);
      expect(toasts().length).toBe(0);
    });

    it('supports an increasing progress animation', async () => {
      service.info('x', undefined, {
        progressBar: true,
        progressAnimation: 'increasing',
      });
      await render();
      expect(toasts()[0].querySelector('.progress-bar')!.classList).toContain(
        'toast-progress-increasing',
      );
    });

    it('pauses on hover and closes after extendedTimeOut on leave', async () => {
      service.info('x', undefined, {
        timeOut: 1000,
        extendedTimeOut: 300,
        progressBar: true,
      });
      await render();
      const toast = toasts()[0];
      toast.dispatchEvent(new MouseEvent('mouseenter'));
      await render();
      expect(toast.querySelector('.progress-bar')).toBeNull();
      await tick(5000);
      expect(toasts().length).toBe(1);
      toast.dispatchEvent(new MouseEvent('mouseleave'));
      await render();
      expect(
        toast.querySelector<HTMLElement>('.progress-bar')!.style
          .animationDuration,
      ).toBe('300ms');
      await tick(300);
      expect(toasts().length).toBe(0);
    });

    it('disableTimeOut: true keeps the toast even after hover', async () => {
      const { toastRef } = service.info('x', undefined, {
        disableTimeOut: true,
      });
      await tick(10000);
      toastRef.pause();
      toastRef.resume();
      await tick(10000);
      expect(toastRef.isClosed()).toBe(false);
      expect(toastRef.hasTimer()).toBe(false);
    });

    it("disableTimeOut: 'timeOut' only uses extendedTimeOut", async () => {
      const { toastRef } = service.info('x', undefined, {
        disableTimeOut: 'timeOut',
        extendedTimeOut: 100,
      });
      await tick(10000);
      expect(toastRef.isClosed()).toBe(false);
      toastRef.resetTimeout();
      expect(toastRef.hasTimer()).toBe(false);
      toastRef.resume();
      await tick(100);
      expect(toastRef.isClosed()).toBe(true);
    });

    it("disableTimeOut: 'extendedTimeOut' keeps a hovered toast", async () => {
      const { toastRef } = service.info('x', undefined, {
        disableTimeOut: 'extendedTimeOut',
        timeOut: 100,
      });
      toastRef.pause();
      toastRef.resume();
      await tick(10000);
      expect(toastRef.isClosed()).toBe(false);
    });

    it('ignores timer calls on closed or inactive toasts', async () => {
      service.config.maxOpened = 1;
      const first = service.info('1');
      const queued = service.info('2');
      queued.toastRef.pause();
      queued.toastRef.resume();
      queued.toastRef.resetTimeout();
      expect(queued.toastRef.isActive()).toBe(false);
      expect(queued.toastRef.hasTimer()).toBe(false);

      first.toastRef.close();
      first.toastRef.close();
      first.toastRef.activate();
      first.toastRef.pause();
      first.toastRef.tap();
      expect(first.toastRef.isActive()).toBe(false);
      queued.toastRef.activate();
      expect(queued.toastRef.isActive()).toBe(true);
    });
  });

  describe('tap', () => {
    beforeEach(() => setup());

    it('emits onTap and dismisses when clicked', async () => {
      const tapped = vi.fn();
      service.info('x').onTap.subscribe(tapped);
      await render();
      toasts()[0].click();
      await render();
      expect(tapped).toHaveBeenCalled();
      expect(toasts().length).toBe(0);
    });

    it('stays open when tapToDismiss is false', async () => {
      service.info('x', undefined, { tapToDismiss: false });
      await render();
      toasts()[0].click();
      await render();
      expect(toasts().length).toBe(1);
    });
  });

  describe('duplicates', () => {
    it('returns the existing toast and counts duplicates', async () => {
      setup({ preventDuplicates: true, countDuplicates: true });
      const a = service.info('same');
      const b = service.info('same');
      expect(b.toastId).toBe(a.toastId);
      expect(service.toasts().length).toBe(1);
      await render();
      expect(toasts()[0].querySelector('.badge')!.textContent).toBe('2');
      service.info('same', 'With title');
      expect(service.toasts().length).toBe(1);
    });

    it('shows the duplicate badge in the header when there is a title', async () => {
      setup({ preventDuplicates: true, countDuplicates: true });
      service.info('m', 't');
      service.info('m', 't');
      await render();
      expect(
        toasts()[0].querySelector('.toast-header .badge')!.textContent,
      ).toBe('2');
    });

    it('resets the timeout of a duplicate', async () => {
      setup({
        preventDuplicates: true,
        resetTimeoutOnDuplicate: true,
        timeOut: 1000,
      });
      const a = service.info('same');
      await tick(900);
      service.info('same');
      await tick(900);
      expect(a.toastRef.isClosed()).toBe(false);
      await tick(100);
      expect(a.toastRef.isClosed()).toBe(true);
    });

    it('compares titles when includeTitleDuplicates is set', async () => {
      setup({ preventDuplicates: true, includeTitleDuplicates: true });
      service.info('m', 'A');
      service.info('m', 'B');
      expect(service.toasts().length).toBe(2);
      service.info('untitled');
      service.info('untitled');
      expect(service.toasts().length).toBe(3);
      service.clear(service.toasts()[2].toastId);
      service.info(undefined, 'only title');
      expect(service.show(undefined, 'only title').title).toBe('only title');
      expect(service.toasts().length).toBe(3);
    });

    it('does not treat empty toasts as duplicates', async () => {
      setup({ preventDuplicates: true });
      service.show();
      service.show();
      expect(service.toasts().length).toBe(2);
      expect(
        service.findDuplicate(undefined, undefined, false, false),
      ).not.toBeNull();
      expect(service.findDuplicate('', 'missing', false, false)).toBeNull();
    });
  });

  describe('maxOpened', () => {
    it('queues toasts and activates them when one closes', async () => {
      setup({ maxOpened: 1 });
      const a = service.info('a');
      const b = service.info('b');
      await render();
      expect(service.currentlyActive).toBe(1);
      expect(toasts().map((t) => t.textContent!.trim())).toEqual(['a']);
      a.toastRef.close();
      await render();
      expect(b.toastRef.isActive()).toBe(true);
      expect(toasts().map((t) => t.textContent!.trim())).toEqual(['b']);
      b.toastRef.close();
      expect(service.toasts().length).toBe(0);
    });

    it('activates queued toasts oldest first even when newest are on top', () => {
      setup({ maxOpened: 1, newestOnTop: true });
      const a = service.info('a');
      const b = service.info('b');
      const c = service.info('c');
      a.toastRef.close();
      expect(b.toastRef.isActive()).toBe(true);
      expect(c.toastRef.isActive()).toBe(false);
    });

    it('dismisses the oldest toast with autoDismiss', async () => {
      setup({ maxOpened: 2, autoDismiss: true });
      const a = service.info('a');
      service.info('b');
      service.info('c');
      expect(a.toastRef.isClosed()).toBe(true);
      expect(service.currentlyActive).toBe(2);
    });
  });

  describe('clear/remove', () => {
    beforeEach(() => setup());

    it('clear(id) closes one toast, clear() closes all', async () => {
      const a = service.info('a');
      service.info('b');
      service.clear(a.toastId);
      expect(service.toasts().length).toBe(1);
      service.clear();
      expect(service.toasts().length).toBe(0);
    });

    it('remove() reports whether a toast existed', async () => {
      const a = service.info('a');
      expect(service.remove(a.toastId)).toBe(true);
      expect(service.remove(a.toastId)).toBe(false);
    });
  });
});
