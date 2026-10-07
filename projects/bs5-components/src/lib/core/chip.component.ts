import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { closeButtonTheme } from '../util/bs-theme';

/**
 * A Bootstrap badge used as a chip; focusable (programmatically) for keyboard navigation.
 *
 * Sized to fit the 24px inner line of a `.form-control`/`.form-select` with body-sized text: `fs-6` text, `lh-base`
 * line height and no vertical padding. The remove button keeps `.btn-close`'s own padding (a ~21px target that doubles
 * as the chip's right padding); `.small` scales its glyph (1em wide) to 0.875em so it does not outweigh the text.
 */
@Component({
  selector: 'app-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'badge d-inline-flex align-items-center gap-1 mw-100 fw-normal fs-6 lh-base py-0 ps-2 focus-ring',
    '[class]': 'variantClass()',
    '[class.pe-2]': '!removable()',
    'tabindex': '-1'
  },
  template: `
    <span class="text-truncate"><ng-content /></span>
    @if (removable()) {
      <button type="button" class="btn-close small" tabindex="-1" [attr.data-bs-theme]="closeTheme()"
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
