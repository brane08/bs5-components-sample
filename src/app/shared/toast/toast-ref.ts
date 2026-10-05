import { Injector, computed, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import type { IndividualConfig } from './toast.config';

/** Handle to a single toast: lifecycle, timers and events. */
export class ToastRef {
  private readonly _active = signal(false);
  private readonly _closed = signal(false);
  private readonly _duplicatesCount = signal(0);
  private readonly _timerDuration = signal(0);
  private readonly _timerCycle = signal(0);
  private timer?: ReturnType<typeof setTimeout>;

  private readonly shown$ = new Subject<void>();
  private readonly hidden$ = new Subject<void>();
  private readonly tap$ = new Subject<void>();
  private readonly action$ = new Subject<unknown>();

  /** Rendered and counting down (queued toasts are inactive). */
  readonly isActive = this._active.asReadonly();
  readonly isClosed = this._closed.asReadonly();
  readonly duplicatesCount = this._duplicatesCount.asReadonly();
  /** Duration in ms of the running countdown; 0 when no timer runs. */
  readonly timerDuration = this._timerDuration.asReadonly();
  /** Changes every time a countdown (re)starts, e.g. to restart a progress animation. */
  readonly timerCycle = this._timerCycle.asReadonly();
  readonly hasTimer = computed(() => this._timerDuration() > 0);

  constructor(
    private readonly config: IndividualConfig,
    private readonly onClose: () => void
  ) {}

  afterActivate(): Observable<void> { return this.shown$.asObservable(); }
  afterClosed(): Observable<void> { return this.hidden$.asObservable(); }
  onTap(): Observable<void> { return this.tap$.asObservable(); }
  onAction(): Observable<unknown> { return this.action$.asObservable(); }

  /** Starts the toast (called by the service when it becomes visible). */
  activate() {
    if (this._active() || this._closed()) {
      return;
    }
    this._active.set(true);
    this.startTimer(this.timeOutEnabled ? this.config.timeOut : 0);
  }

  /** Called once the toast has been rendered. */
  markShown() {
    this.shown$.next();
    this.shown$.complete();
  }

  /** Pointer entered the toast: keep it around (ngx-toastr "stickAround"). */
  pause() {
    if (this._active() && !this._closed()) {
      this.startTimer(0);
    }
  }

  /** Pointer left the toast: hide it after `extendedTimeOut`. */
  resume() {
    const disabled = this.config.disableTimeOut;
    if (!this._active() || this._closed() || disabled === true || disabled === 'extendedTimeOut') {
      return;
    }
    this.startTimer(this.config.extendedTimeOut);
  }

  /** Restarts the main timeout (used for duplicates). */
  resetTimeout() {
    if (this._active() && !this._closed()) {
      this.startTimer(this.timeOutEnabled ? this.config.timeOut : 0);
    }
  }

  countDuplicate() {
    this._duplicatesCount.update(n => n + 1);
  }

  /** Toast body was clicked. */
  tap() {
    if (this._closed()) {
      return;
    }
    this.tap$.next();
    if (this.config.tapToDismiss) {
      this.close();
    }
  }

  /** Lets custom toast components report actions (buttons etc.). */
  triggerAction(action?: unknown) {
    this.action$.next(action);
  }

  manualClose() {
    this.close();
  }

  close() {
    if (this._closed()) {
      return;
    }
    clearTimeout(this.timer);
    this._timerDuration.set(0);
    this._closed.set(true);
    this._active.set(false);
    this.onClose();
    this.hidden$.next();
    for (const s of [this.shown$, this.hidden$, this.tap$, this.action$]) {
      s.complete();
    }
  }

  private get timeOutEnabled() {
    const disabled = this.config.disableTimeOut;
    return disabled !== true && disabled !== 'timeOut';
  }

  private startTimer(ms: number) {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (ms > 0) {
      this.timer = setTimeout(() => this.close(), ms);
      this._timerCycle.update(n => n + 1);
    }
    this._timerDuration.set(ms > 0 ? ms : 0);
  }
}

/** Everything a toast component needs; injectable inside `toastComponent`. */
export class ToastPackage<TPayload = unknown> {
  /** Injector used to render the toast component (provides this package). */
  readonly injector: Injector;

  constructor(
    readonly toastId: number,
    readonly config: IndividualConfig<TPayload>,
    readonly message: string | undefined,
    readonly title: string | undefined,
    readonly toastType: string,
    /** Bootstrap color classes resolved from `iconClasses`. */
    readonly typeClass: string,
    readonly toastRef: ToastRef,
    parent: Injector
  ) {
    this.injector = Injector.create({ providers: [{ provide: ToastPackage, useValue: this }], parent });
  }

  triggerTap() { this.toastRef.tap(); }
  triggerAction(action?: unknown) { this.toastRef.triggerAction(action); }
}

/** Returned by `ToastService.show()` and friends (mirrors ngx-toastr's ActiveToast). */
export interface ActiveToast<TPayload = unknown> {
  toastId: number;
  message?: string;
  title?: string;
  toastRef: ToastRef;
  package: ToastPackage<TPayload>;
  onShown: Observable<void>;
  onHidden: Observable<void>;
  onTap: Observable<void>;
  onAction: Observable<unknown>;
}
