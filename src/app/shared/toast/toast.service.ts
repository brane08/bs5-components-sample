import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'info' | 'warning' | 'danger';

export interface ToastOptions {
  title?: string;
  /** Auto-dismiss delay in ms; 0 keeps the toast until closed. */
  timeOut?: number;
}

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
  timeOut: number;
}

export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly defaultTimeOut = 5000;
  readonly position = signal<ToastPosition>('top-right');
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  success(message: string, options?: ToastOptions) { return this.show('success', message, options); }
  info(message: string, options?: ToastOptions) { return this.show('info', message, options); }
  warning(message: string, options?: ToastOptions) { return this.show('warning', message, options); }
  error(message: string, options?: ToastOptions) { return this.show('danger', message, options); }

  show(type: ToastType, message: string, options: ToastOptions = {}): number {
    const toast: Toast = {
      id: this.nextId++,
      type,
      message,
      title: options.title,
      timeOut: options.timeOut ?? this.defaultTimeOut
    };
    this.toasts.update(list => [...list, toast]);
    if (toast.timeOut > 0) {
      this.timers.set(toast.id, setTimeout(() => this.remove(toast.id), toast.timeOut));
    }
    return toast.id;
  }

  remove(id: number) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  clear() {
    this.toasts().forEach(t => this.remove(t.id));
  }
}
