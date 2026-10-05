import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChipComponent } from './chip.component';
import { format } from './format';

describe('format', () => {
  it('replaces known placeholders and keeps unknown ones', () => {
    expect(format('Remove {label}', { label: 'Java' })).toBe('Remove Java');
    expect(format('{count} of {total}', { count: '1' })).toBe('1 of {total}');
  });
});

describe('ChipComponent', () => {
  @Component({
    imports: [ChipComponent],
    template: `<app-chip class="extra" [variant]="variant()" [removable]="removable()" removeLabel="Drop it"
                         (remove)="removed = removed + 1">Label</app-chip>`
  })
  class Host {
    variant = signal('primary');
    removable = signal(true);
    removed = 0;
  }

  it('renders a focusable Bootstrap badge with a themed remove button', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const chip: HTMLElement = f.nativeElement.querySelector('app-chip');
    expect(chip.className).toContain('badge');
    expect(chip.className).toContain('focus-ring');
    expect(chip.classList).toContain('extra');
    expect(chip.classList).toContain('text-bg-primary');
    expect(chip.getAttribute('tabindex')).toBe('-1');
    expect(chip.textContent!.trim()).toBe('Label');
    const button = chip.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Drop it');
    expect(button.getAttribute('data-bs-theme')).toBe('dark');
    const down = new MouseEvent('mousedown', { cancelable: true, bubbles: true });
    button.dispatchEvent(down);
    expect(down.defaultPrevented).toBeTrue();
    button.click();
    expect(f.componentInstance.removed).toBe(1);
    f.componentInstance.variant.set('light');
    f.componentInstance.removable.set(false);
    f.detectChanges();
    expect(chip.classList).toContain('text-bg-light');
    expect(chip.classList).not.toContain('text-bg-primary');
    expect(chip.querySelector('button')).toBeNull();
  });
});
