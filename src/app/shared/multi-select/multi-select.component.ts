import { ChangeDetectorRef, Component, ElementRef, HostListener, Input, forwardRef, inject, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Bootstrap 5 multi-select in the spirit of ng-select: chips for the selection,
 * searchable dropdown with checkboxes, keyboard navigation, ControlValueAccessor.
 * Items may be primitives or objects (use bindLabel / bindValue).
 */
@Component({
  selector: 'app-multi-select',
  templateUrl: './multi-select.component.html',
  styleUrls: ['./multi-select.component.scss'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => MultiSelectComponent),
    multi: true
  }]
})
export class MultiSelectComponent implements ControlValueAccessor {
  @Input() items: any[] = [];
  @Input() bindLabel?: string;
  /** When set, the model holds item[bindValue]; otherwise the whole item. */
  @Input() bindValue?: string;
  @Input() placeholder = 'Select...';
  @Input() searchable = true;
  @Input() closeOnSelect = false;
  /** 0 = unlimited */
  @Input() maxSelected = 0;
  @Input() type = 'secondary';
  @Input() disabled = false;

  readonly open = signal(false);
  readonly search = signal('');
  readonly active = signal(0);
  protected selected: any[] = [];

  private cdr = inject(ChangeDetectorRef);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private onChange: (v: any[]) => void = () => {};
  private onTouched: () => void = () => {};

  label(item: any): string {
    return this.bindLabel && item != null && typeof item === 'object' ? String(item[this.bindLabel]) : String(item);
  }

  private value(item: any): any {
    return this.bindValue && item != null && typeof item === 'object' ? item[this.bindValue] : item;
  }

  get selectedItems(): any[] {
    return this.selected.map(v => this.items.find(i => this.value(i) === v) ?? v);
  }

  get filtered(): any[] {
    const q = this.search().trim().toLowerCase();
    return q ? this.items.filter(i => this.label(i).toLowerCase().includes(q)) : this.items;
  }

  isSelected(item: any) {
    return this.selected.includes(this.value(item));
  }

  isDisabledItem(item: any) {
    return !this.isSelected(item) && this.maxSelected > 0 && this.selected.length >= this.maxSelected;
  }

  toggle(item: any) {
    if (this.disabled || this.isDisabledItem(item)) {
      return;
    }
    const v = this.value(item);
    this.emit(this.isSelected(item) ? this.selected.filter(s => s !== v) : [...this.selected, v]);
    if (this.closeOnSelect) {
      this.close();
    }
  }

  removeItem(item: any, event?: Event) {
    event?.stopPropagation();
    if (this.disabled) {
      return;
    }
    const v = this.value(item);
    this.emit(this.selected.filter(s => s !== v));
  }

  clear(event?: Event) {
    event?.stopPropagation();
    if (!this.disabled) {
      this.emit([]);
    }
  }

  openPanel() {
    if (!this.disabled) {
      this.open.set(true);
    }
  }

  close() {
    if (this.open()) {
      this.open.set(false);
      this.search.set('');
      this.active.set(0);
      this.onTouched();
    }
  }

  onSearch(event: Event) {
    this.search.set((event.target as HTMLInputElement).value);
    this.active.set(0);
    this.openPanel();
  }

  onKeydown(event: KeyboardEvent) {
    const list = this.filtered;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.openPanel();
        this.active.set(Math.min(this.active() + 1, list.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.set(Math.max(this.active() - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (this.open() && list[this.active()] !== undefined) {
          this.toggle(list[this.active()]);
        } else {
          this.openPanel();
        }
        break;
      case 'Escape':
        this.close();
        break;
      case 'Backspace':
        if (!this.search() && this.selected.length) {
          this.emit(this.selected.slice(0, -1));
        }
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  private emit(values: any[]) {
    this.selected = values;
    this.onChange(values);
  }

  writeValue(value: any[] | null): void {
    this.selected = Array.isArray(value) ? [...value] : [];
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: any[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }
}
