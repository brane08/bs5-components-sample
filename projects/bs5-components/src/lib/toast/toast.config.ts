import { EnvironmentProviders, InjectionToken, Type, makeEnvironmentProviders } from '@angular/core';
import { BsToastComponent } from './toast.component';

export type ToastPositionClass =
  | 'toast-top-right'
  | 'toast-top-left'
  | 'toast-top-center'
  | 'toast-top-full-width'
  | 'toast-bottom-right'
  | 'toast-bottom-left'
  | 'toast-bottom-center'
  | 'toast-bottom-full-width';

export const TOAST_POSITIONS: readonly ToastPositionClass[] = [
  'toast-top-right', 'toast-top-left', 'toast-top-center', 'toast-top-full-width',
  'toast-bottom-right', 'toast-bottom-left', 'toast-bottom-center', 'toast-bottom-full-width'
];

/** Options that can be overridden per toast (mirrors ngx-toastr's IndividualConfig). */
export interface IndividualConfig<TPayload = unknown> {
  /** `true` disables both timers, or name the one to disable. */
  disableTimeOut: boolean | 'timeOut' | 'extendedTimeOut';
  /** Auto-dismiss delay in ms. */
  timeOut: number;
  /** Delay in ms after the pointer leaves a hovered toast. */
  extendedTimeOut: number;
  closeButton: boolean;
  progressBar: boolean;
  progressAnimation: 'decreasing' | 'increasing';
  /** Render title/message as (sanitized) HTML. */
  enableHtml: boolean;
  /** Close the toast when it is clicked. */
  tapToDismiss: boolean;
  positionClass: ToastPositionClass;
  /** Base classes of the toast element. */
  toastClass: string;
  titleClass: string;
  messageClass: string;
  /** Enter/leave animation duration in ms. */
  easeTime: number;
  /** Component used to render the toast; it can inject `ToastPackage`. */
  toastComponent: Type<unknown>;
  /** Accessible label of the close button. */
  closeLabel: string;
  /** Accessible label of the duplicate counter badge. */
  duplicatesLabel: string;
  payload?: TPayload;
}

/** Application-wide options (mirrors ngx-toastr's GlobalConfig). */
export interface GlobalConfig extends IndividualConfig {
  /** Max toasts visible at once; extra toasts wait in a queue. 0 = unlimited. */
  maxOpened: number;
  /** When `maxOpened` is reached, dismiss the oldest toast instead of queueing. */
  autoDismiss: boolean;
  newestOnTop: boolean;
  preventDuplicates: boolean;
  includeTitleDuplicates: boolean;
  resetTimeoutOnDuplicate: boolean;
  countDuplicates: boolean;
  /** Toast type -> Bootstrap color classes. */
  iconClasses: Record<string, string>;
}

export const DEFAULT_TOAST_CONFIG: GlobalConfig = {
  disableTimeOut: false,
  timeOut: 5000,
  extendedTimeOut: 1000,
  closeButton: false,
  progressBar: false,
  progressAnimation: 'decreasing',
  enableHtml: false,
  tapToDismiss: true,
  positionClass: 'toast-top-right',
  toastClass: 'toast',
  titleClass: 'me-auto',
  messageClass: '',
  easeTime: 300,
  toastComponent: BsToastComponent,
  maxOpened: 0,
  autoDismiss: false,
  newestOnTop: true,
  preventDuplicates: false,
  includeTitleDuplicates: false,
  resetTimeoutOnDuplicate: false,
  countDuplicates: false,
  iconClasses: {
    error: 'text-bg-danger',
    info: 'text-bg-info',
    success: 'text-bg-success',
    warning: 'text-bg-warning'
  },
  closeLabel: 'Close',
  duplicatesLabel: 'Repeated'
};

export const TOAST_CONFIG = new InjectionToken<Partial<GlobalConfig>>('TOAST_CONFIG');

/** Registers global toast options: `providers: [provideToastr({ timeOut: 3000 })]`. */
export function provideToastr(config: Partial<GlobalConfig> = {}): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: TOAST_CONFIG, useValue: config }]);
}
