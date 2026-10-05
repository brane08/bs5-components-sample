import { Directive, DoCheck, booleanAttribute, inject, input, linkedSignal, signal } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';

/**
 * Form plumbing shared by the components: works with `ngModel`, reactive forms and Signal Forms (`[formField]`,
 * through Angular's NgControl interop). The component registers itself as value accessor on the bound control
 * (instead of providing NG_VALUE_ACCESSOR) so the control state can drive Bootstrap's `.is-invalid`.
 */
@Directive()
export abstract class BsFormControl<T> implements ControlValueAccessor, DoCheck {
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly disabledState = linkedSignal(() => this.disabled());
  /** True once the bound control is invalid and touched. */
  protected readonly invalid = signal(false);
  protected onChange: (value: T) => void = () => {};
  protected onTouched: () => void = () => {};

  private readonly ngControl = inject(NgControl, { self: true, optional: true });

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  ngDoCheck() {
    const control = this.ngControl;
    this.invalid.set(control?.invalid === true && control.touched === true);
  }

  abstract writeValue(value: T | null): void;

  registerOnChange(fn: (value: T) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledState.set(isDisabled);
  }
}
