import {
  ApplicationRef, ComponentRef, DOCUMENT, DestroyRef, EnvironmentInjector, Injectable, afterNextRender,
  createComponent, inject, signal
} from '@angular/core';
import { DEFAULT_TOAST_CONFIG, GlobalConfig, IndividualConfig, TOAST_CONFIG } from './toast.config';
import { ActiveToast, ToastPackage, ToastRef } from './toast-ref';
import { ToastContainerComponent } from './toast-container.component';

/**
 * ngx-toastr style toast service rendering Bootstrap 5 toasts.
 * The container is attached to <body> automatically on first use.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  /** Global options; mutable at runtime like ngx-toastr's `toastrConfig`. */
  readonly config: GlobalConfig = { ...DEFAULT_TOAST_CONFIG, ...inject(TOAST_CONFIG, { optional: true }) };

  private readonly _toasts = signal<ToastPackage[]>([]);
  /** Active and queued toasts in creation order. */
  readonly toasts = this._toasts.asReadonly();

  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private containerRef?: ComponentRef<ToastContainerComponent>;
  private index = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this._toasts().forEach(t => t.toastRef.close());
      if (this.containerRef) {
        this.containerRef.destroy();
        this.containerRef.location.nativeElement.remove();
      }
    });
  }

  get currentlyActive(): number {
    return this._toasts().filter(t => t.toastRef.isActive()).length;
  }

  success<P = unknown>(message?: string, title?: string, override?: Partial<IndividualConfig<P>>) {
    return this.show(message, title, override, 'success');
  }

  error<P = unknown>(message?: string, title?: string, override?: Partial<IndividualConfig<P>>) {
    return this.show(message, title, override, 'error');
  }

  info<P = unknown>(message?: string, title?: string, override?: Partial<IndividualConfig<P>>) {
    return this.show(message, title, override, 'info');
  }

  warning<P = unknown>(message?: string, title?: string, override?: Partial<IndividualConfig<P>>) {
    return this.show(message, title, override, 'warning');
  }

  /**
   * Shows a toast. Returns the existing toast when it is a prevented duplicate.
   * When `maxOpened` is reached the toast is queued (or the oldest dismissed with `autoDismiss`).
   */
  show<P = unknown>(message?: string, title?: string, override: Partial<IndividualConfig<P>> = {},
                    type = ''): ActiveToast<P> {
    const global = this.config;
    if (global.preventDuplicates && (message || (global.includeTitleDuplicates && title))) {
      const duplicate = this.findDuplicate(title ?? '', message ?? '', global.resetTimeoutOnDuplicate,
        global.countDuplicates);
      if (duplicate) {
        return duplicate as ActiveToast<P>;
      }
    }

    const config: IndividualConfig<P> = { ...global, ...override } as IndividualConfig<P>;
    const toastId = ++this.index;
    const toastRef = new ToastRef(config, () => this.detach(toastId));
    const pkg = new ToastPackage<P>(toastId, config, message, title, type, global.iconClasses[type] ?? '',
      toastRef, this.injector);

    let activate = true;
    if (global.maxOpened > 0 && this.currentlyActive >= global.maxOpened) {
      activate = global.autoDismiss;
      if (global.autoDismiss) {
        this._toasts().find(t => t.toastRef.isActive())!.toastRef.close();
      }
    }

    this._toasts.update(list => [...list, pkg as ToastPackage]);
    this.ensureContainer();
    if (activate) {
      this.activate(pkg as ToastPackage);
    }
    return this.toActive(pkg);
  }

  /** Closes one toast, or all of them when no id is given. */
  clear(toastId?: number) {
    for (const t of this._toasts()) {
      if (toastId === undefined || t.toastId === toastId) {
        t.toastRef.manualClose();
      }
    }
  }

  /** Removes a toast; returns false when it does not exist. */
  remove(toastId: number): boolean {
    const toast = this._toasts().find(t => t.toastId === toastId);
    toast?.toastRef.close();
    return !!toast;
  }

  findDuplicate(title = '', message = '', resetOnDuplicate: boolean, countDuplicates: boolean): ActiveToast | null {
    const includeTitle = this.config.includeTitleDuplicates;
    const match = this._toasts().find(t =>
      (t.message ?? '') === message && (!includeTitle || (t.title ?? '') === title));
    if (!match) {
      return null;
    }
    if (resetOnDuplicate) {
      match.toastRef.resetTimeout();
    }
    if (countDuplicates) {
      match.toastRef.countDuplicate();
    }
    return this.toActive(match);
  }

  private activate(pkg: ToastPackage) {
    pkg.toastRef.activate();
    afterNextRender({ read: () => pkg.toastRef.markShown() }, { injector: this.injector });
  }

  private detach(toastId: number) {
    this._toasts.update(list => list.filter(t => t.toastId !== toastId));
    const max = this.config.maxOpened;
    if (max <= 0 || this.currentlyActive < max) {
      const next = this._toasts().find(t => !t.toastRef.isActive());
      if (next) {
        this.activate(next);
      }
    }
  }

  private toActive<P>(pkg: ToastPackage<P>): ActiveToast<P> {
    const ref = pkg.toastRef;
    return {
      toastId: pkg.toastId,
      message: pkg.message,
      title: pkg.title,
      toastRef: ref,
      package: pkg,
      onShown: ref.afterActivate(),
      onHidden: ref.afterClosed(),
      onTap: ref.onTap(),
      onAction: ref.onAction()
    };
  }

  private ensureContainer() {
    if (this.containerRef) {
      return;
    }
    this.containerRef = createComponent(ToastContainerComponent, { environmentInjector: this.injector });
    this.document.body.appendChild(this.containerRef.location.nativeElement);
    this.appRef.attachView(this.containerRef.hostView);
  }
}
