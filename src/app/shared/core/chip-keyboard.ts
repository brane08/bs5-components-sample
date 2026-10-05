import { ElementRef, Injector, afterNextRender } from '@angular/core';

export interface ChipList {
  removeChip(index: number): Promise<boolean> | boolean;
  focusInput(): void;
}

/**
 * Keyboard navigation between chips (`app-chip`) of a component, as in ngx-chips:
 * ←/→ move, Backspace/Delete remove (focusing a neighbour), Escape returns to the input.
 */
export class ChipKeyboard {
  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly injector: Injector,
    private readonly list: ChipList
  ) {}

  keydown(event: KeyboardEvent, index: number) {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.focus(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.focus(index + 1);
        break;
      case 'Backspace':
      case 'Delete': {
        event.preventDefault();
        const next = event.key === 'Backspace' ? index - 1 : index;
        void Promise.resolve(this.list.removeChip(index)).then(done => {
          if (done) {
            this.focus(next);
          }
        });
        break;
      }
      case 'Escape':
        this.list.focusInput();
        break;
    }
  }

  /** Focuses the chip at `index` after the next render (index below 0 = first, past the end = the input). */
  focus(index: number) {
    afterNextRender({
      write: () => {
        const chips = this.host.nativeElement.querySelectorAll<HTMLElement>('app-chip');
        if (!chips.length || index >= chips.length) {
          this.list.focusInput();
        } else {
          chips[Math.max(index, 0)].focus();
        }
      }
    }, { injector: this.injector });
  }
}
