import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { closeButtonTheme } from '../util/bs-theme';

/** A Bootstrap badge used as a chip; focusable (programmatically) for keyboard navigation. */
@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'badge d-inline-flex align-items-center gap-1 mw-100 fw-normal focus-ring',
    '[class]': 'variantClass()',
    'tabindex': '-1'
  },
  template: `
    <span class="text-truncate"><ng-content /></span>
    @if (removable()) {
      <button type="button" class="btn-close p-0" tabindex="-1" [attr.data-bs-theme]="closeTheme()"
              [attr.aria-label]="removeLabel()" (mousedown)="$event.preventDefault()"
              (click)="$event.stopPropagation(); remove.emit()"></button>
    }`
})
export class ChipComponent {
  /** Bootstrap variant (`text-bg-*`). */
  readonly variant = input('secondary');
  readonly removable = input(false, { transform: booleanAttribute });
  readonly removeLabel = input('Remove');
  readonly remove = output<void>();

  protected readonly variantClass = computed(() => `text-bg-${this.variant()}`);
  protected readonly closeTheme = computed(() => closeButtonTheme(this.variantClass()));
}
