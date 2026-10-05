import { inject, signal } from '@angular/core';
import { ControlValueAccessor, NgControl } from '@angular/forms';

/**
 * Form plumbing shared by the components; works with `ngModel`, reactive forms and Signal Forms (`[formField]`,
 * through Angular's NgControl interop). Registers the component as value accessor on the bound control (instead of
 * providing NG_VALUE_ACCESSOR) so the control state can drive Bootstrap's `.is-invalid`.
 *
 * Create it in a field initializer (injection context): `private readonly form = new FormControlBridge(this);`
 * and call `check()` from `ngDoCheck`.
 */
export class FormControlBridge<T> {
  /** True once the bound control is invalid and touched. */
  readonly invalid = signal(false);
  onChange: (value: T) => void = () => {};
  onTouched: () => void = () => {};

  private readonly ngControl = inject(NgControl, { self: true, optional: true });

  constructor(accessor: ControlValueAccessor) {
    if (this.ngControl) {
      this.ngControl.valueAccessor = accessor;
    }
  }

  check() {
    const control = this.ngControl;
    this.invalid.set(control?.invalid === true && control.touched === true);
  }
}
