import { ChangeDetectorRef, Component, EventEmitter, Input, Output, forwardRef, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-tag-input',
  templateUrl: './tag-input.component.html',
  styleUrls: ['./tag-input.component.scss'],
  imports: [NgClass, FormsModule],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => TagInputComponent),
    multi: true
  }]
})
export class TagInputComponent implements ControlValueAccessor {

  @Input()
  tags: string[] = [];
  @Output()
  tagsChange = new EventEmitter<string[]>();
  @Input("allow-space")
  allowSpace = true;
  @Input("editor")
  editor = true;
  @Input()
  type: string = "secondary";
  @Input()
  disabled = false;
  txtModel = "";

  private cdr = inject(ChangeDetectorRef);
  private onChange: (v: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  remove(index: number) {
    if (this.disabled || index < 0 || index >= this.tags.length) {
      return;
    }
    this.update(this.tags.filter((_, i) => i !== index));
  }

  onKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case "Enter":
        event.preventDefault();
        this.appendTag();
        break;
      case " ":
        if (!this.allowSpace) {
          event.preventDefault();
          this.appendTag();
        }
        break;
      case "Backspace":
        if (this.txtModel === "") {
          this.remove(this.tags.length - 1);
        }
        break;
    }
  }

  commit() {
    this.appendTag();
    this.onTouched();
  }

  writeValue(value: string[] | null): void {
    this.tags = Array.isArray(value) ? [...value] : [];
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  private appendTag() {
    if (this.disabled) {
      return;
    }
    const value = this.txtModel.trim();
    this.txtModel = "";
    if (value !== "" && !this.tags.includes(value)) {
      this.update([...this.tags, value]);
    }
  }

  private update(tags: string[]) {
    this.tags = tags;
    this.tagsChange.emit(tags);
    this.onChange(tags);
  }
}
