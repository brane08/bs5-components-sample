import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, booleanAttribute, computed,
  contentChild, inject, input, linkedSignal, model, numberAttribute, output, signal, viewChild
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { AsyncValidatorFn, FormControl, ValidatorFn, Validators } from '@angular/forms';
import { Observable, Subscription, firstValueFrom, from, isObservable } from 'rxjs';
import { BsFormControl } from '../core/bs-form-control';
import { ChipKeyboard } from '../core/chip-keyboard';
import { ChipComponent } from '../core/chip.component';
import { format } from '../core/format';
import { resolvePath } from '../util/bs-theme';
import { TagDragService } from './tag-drag.service';
import { TAG_INPUT_CONFIG } from './tag-input.config';
import { TagAutocompleteFn, TagHook, TagMatchingFn, TagModel } from './tag-input.types';
import { TagDropdownItemTemplate, TagTemplate } from './tag-templates';

let nextId = 0;

/**
 * Bootstrap 5 chips input with ngx-chips' feature set: string or object tags, separators, paste, validation,
 * add/remove hooks, editing, keyboard navigation, autocomplete, and drag & drop between inputs.
 * Supports `[(tags)]`, `ngModel`, reactive forms and Signal Forms (`[formField]`).
 */
@Component({
  selector: 'app-tag-input',
  templateUrl: './tag-input.component.html',
  styleUrls: ['./tag-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ChipComponent],
  host: { 'class': 'd-block position-relative' }
})
export class TagInputComponent extends BsFormControl<TagModel[]> {
  private readonly config = inject(TAG_INPUT_CONFIG);

  // ---- model
  readonly tags = model<TagModel[]>([]);
  /** Text in the input (two-way bindable). */
  readonly inputText = model('');
  readonly identifyBy = input(this.config.identifyBy);
  readonly displayBy = input(this.config.displayBy);
  /** Keep typed tags as strings (default). When false they become `{ [identifyBy]: text, [displayBy]: text }`. */
  readonly modelAsStrings = input(this.config.modelAsStrings, { transform: booleanAttribute });

  // ---- adding & removing
  readonly maxItems = input(0, { transform: numberAttribute });
  /** Keys that add the current text, besides Enter (e.g. `[',', ';']`). */
  readonly separatorKeys = input<string[]>(this.config.separatorKeys);
  readonly separatorKeyCodes = input<number[]>(this.config.separatorKeyCodes);
  /** `false` makes Space a separator. */
  readonly allowSpace = input(true, { alias: 'allow-space', transform: booleanAttribute });
  readonly addOnBlur = input(this.config.addOnBlur, { transform: booleanAttribute });
  readonly clearOnBlur = input(false, { transform: booleanAttribute });
  readonly addOnPaste = input(this.config.addOnPaste, { transform: booleanAttribute });
  readonly pasteSplitPattern = input<string | RegExp>(this.config.pasteSplitPattern);
  readonly trimTags = input(this.config.trimTags, { transform: booleanAttribute });
  readonly allowDupes = input(this.config.allowDupes, { transform: booleanAttribute });
  readonly blinkIfDupe = input(true, { transform: booleanAttribute });
  readonly removable = input(this.config.removable, { transform: booleanAttribute });
  /** Double-click a tag to edit it. */
  readonly editable = input(this.config.editable, { transform: booleanAttribute });
  readonly onlyFromAutocomplete = input(false, { transform: booleanAttribute });
  readonly onAdding = input<TagHook>();
  readonly onRemoving = input<TagHook>();

  // ---- validation of the typed text
  readonly validators = input<ValidatorFn[]>([]);
  readonly asyncValidators = input<AsyncValidatorFn[]>([]);
  /** Validation error key -> message shown below the control. */
  readonly errorMessages = input<Record<string, string>>(this.config.errorMessages);

  // ---- rendering
  /** `false` renders the tags read-only without a border. */
  readonly editor = input(true, { transform: booleanAttribute });
  /** Hides the text input; tags can still be removed. */
  readonly hideForm = input(false, { transform: booleanAttribute });
  /** Bootstrap variant for chips (`text-bg-*`). */
  readonly type = input(this.config.type);
  /** Shown when there are tags (or always, when `secondaryPlaceholder` is not set and there are none). */
  readonly placeholder = input(this.config.placeholder);
  /** Shown when there are no tags. */
  readonly secondaryPlaceholder = input<string | undefined>(this.config.secondaryPlaceholder);
  readonly inputId = input<string>();
  readonly inputClass = input('');
  readonly tabindex = input<number | undefined, unknown>(undefined, {
    transform: (v: unknown) => (v == null || v === '' ? undefined : numberAttribute(v))
  });
  readonly textChangeDebounce = input(this.config.textChangeDebounce, { transform: numberAttribute });
  readonly loadingText = input(this.config.loadingText);
  readonly removeTagText = input(this.config.removeTagText);
  readonly editTagText = input(this.config.editTagText);
  readonly addedText = input(this.config.addedText);
  readonly removedText = input(this.config.removedText);

  // ---- autocomplete (inline Bootstrap dropdown)
  readonly autocompleteItems = input<TagModel[]>([]);
  readonly autocompleteObservable = input<TagAutocompleteFn>();
  readonly showDropdownIfEmpty = input(false, { transform: booleanAttribute });
  /** Keep the dropdown open after picking a suggestion. */
  readonly keepOpen = input(true, { transform: booleanAttribute });
  readonly minimumTextLength = input(this.config.minimumTextLength, { transform: numberAttribute });
  /** 0 = unlimited. */
  readonly limitItemsTo = input(0, { transform: numberAttribute });
  readonly matchingFn = input<TagMatchingFn>();
  readonly focusFirstElement = input(false, { transform: booleanAttribute });

  /** Tag inputs sharing a zone accept tags dragged from each other (and reorder their own). */
  readonly dragZone = input<string>();

  // ---- outputs (ngx-chips' onAdd, onRemove, ... without the `on` prefix)
  readonly added = output<TagModel>({ alias: 'add' });
  readonly removed = output<TagModel>({ alias: 'remove' });
  readonly selected = output<TagModel>({ alias: 'select' });
  readonly focused = output<string>({ alias: 'focus' });
  readonly blurred = output<string>({ alias: 'blur' });
  readonly textChange = output<string>();
  readonly pasted = output<string>({ alias: 'paste' });
  readonly validationError = output<TagModel>();
  readonly tagEdited = output<TagModel>();

  protected readonly tagTpl = contentChild(TagTemplate);
  protected readonly dropdownItemTpl = contentChild(TagDropdownItemTemplate);

  protected readonly id = `app-tag-input-${nextId++}`;
  protected readonly listboxId = `${this.id}-listbox`;
  /** Current tags; follows `[tags]` and is also written by the forms API without emitting `tagsChange`. */
  protected readonly value = linkedSignal(() => this.tags());
  protected readonly errors = signal<string[]>([]);
  protected readonly blinkIndex = signal(-1);
  protected readonly editingIndex = signal(-1);
  protected readonly draggingIndex = signal(-1);
  protected readonly dropdownOpen = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly loading = signal(false);
  /** Text of the visually hidden live region (screen-reader announcements). */
  protected readonly announcement = signal('');
  private readonly remoteItems = signal<TagModel[]>([]);

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly editInput = viewChild<ElementRef<HTMLInputElement>>('editInput');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly drag = inject(TagDragService);
  private readonly chipKeyboard = new ChipKeyboard(this.host, this.injector, {
    removeChip: index => this.remove(index),
    focusInput: () => this.focusInput()
  });
  /** Identities of tags whose async validation or `onAdding` hook is still running. */
  private readonly pending = new Set<unknown>();
  private textTimer?: ReturnType<typeof setTimeout>;
  private fetchSub?: Subscription;
  /** Async validators and hooks can resolve after the component is gone; then nothing may be emitted. */
  private destroyed = false;

  protected readonly interactive = computed(() => this.editor() && !this.disabledState());
  protected readonly maxReached = computed(() => this.maxItems() > 0 && this.value().length >= this.maxItems());
  protected readonly showInput = computed(() => this.interactive() && !this.hideForm() && !this.maxReached());
  protected readonly canRemove = computed(() => this.interactive() && this.removable());
  protected readonly hasAutocomplete = computed(() =>
    !!this.autocompleteObservable() || this.autocompleteItems().length > 0);

  protected readonly placeholderText = computed(() => {
    const secondary = this.secondaryPlaceholder();
    if (this.value().length) {
      return secondary === undefined ? '' : this.placeholder();
    }
    return secondary ?? this.placeholder();
  });

  /** Autocomplete suggestions for the current text. */
  readonly suggestions = computed(() => {
    const text = this.inputText();
    if (!this.meetsMinimum(text)) {
      return [];
    }
    const source = this.autocompleteObservable() ? this.remoteItems() : this.autocompleteItems();
    const match = this.matchingFn() ?? ((t: string, item: TagModel) =>
      this.display(item).toLowerCase().includes(t.toLowerCase()));
    let list = source.filter(item => match(text, item));
    if (!this.allowDupes()) {
      list = list.filter(item => this.indexOf(item) < 0);
    }
    const limit = this.limitItemsTo();
    return limit > 0 ? list.slice(0, limit) : list;
  });

  protected readonly dropdownVisible = computed(() =>
    this.dropdownOpen() && this.showInput() && (this.suggestions().length > 0 || this.loading()));

  protected readonly activeId = computed(() =>
    this.dropdownVisible() && this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null);

  constructor() {
    super();
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      clearTimeout(this.textTimer);
      this.fetchSub?.unsubscribe();
    });
  }

  // ---------------------------------------------------------------- public API

  display(item: TagModel): string {
    if (typeof item === 'string') {
      return item;
    }
    return String(resolvePath(item, this.displayBy()) ?? resolvePath(item, this.identifyBy()) ?? '');
  }

  identify(item: TagModel): unknown {
    return typeof item === 'string' ? item : resolvePath(item, this.identifyBy());
  }

  /** Adds a tag (typed text or an autocomplete item). Resolves to whether it was added. */
  async add(raw: TagModel, fromAutocomplete = false): Promise<boolean> {
    if (!this.interactive() || this.maxReached() || (this.onlyFromAutocomplete() && !fromAutocomplete)) {
      return false;
    }
    const trimmed = typeof raw === 'string' && this.trimTags() ? raw.trim() : raw;
    if (trimmed === '') {
      return false;
    }
    let tag = this.normalize(trimmed);
    const id = this.identify(tag);
    if (!this.allowDupes()) {
      const existing = this.indexOf(tag);
      if (existing >= 0 || this.pending.has(id)) {
        if (existing >= 0 && this.blinkIfDupe()) {
          this.blink(existing);
        }
        return false;
      }
    }
    this.pending.add(id);
    try {
      if (!(await this.passesValidation(tag))) {
        return false;
      }
      tag = await this.runHook(this.onAdding(), tag);
    } catch {
      return false;
    } finally {
      this.pending.delete(id);
    }
    if (this.destroyed) {
      return false;
    }
    this.update([...this.value(), tag]);
    this.clearText();
    this.announce(this.addedText(), tag);
    this.added.emit(tag);
    return true;
  }

  /** Removes the tag at `index`. Resolves to whether it was removed. */
  async remove(index: number): Promise<boolean> {
    const tag = this.value()[index];
    if (!this.canRemove() || tag === undefined) {
      return false;
    }
    try {
      await this.runHook(this.onRemoving(), tag);
    } catch {
      return false;
    }
    // The list may have changed while the hook ran: remove this tag, not whatever is at `index` now.
    const current = this.value();
    const at = current[index] === tag ? index : current.indexOf(tag);
    if (at < 0 || this.destroyed) {
      return false;
    }
    this.update(current.filter((_, i) => i !== at));
    this.announce(this.removedText(), tag);
    this.removed.emit(tag);
    return true;
  }

  focusInput() {
    this.input()?.nativeElement.focus();
  }

  // ---------------------------------------------------------------- template helpers

  protected optionId(index: number) {
    return `${this.id}-option-${index}`;
  }

  protected label(text: string, item: TagModel) {
    return format(text, { label: this.display(item) });
  }

  protected tagContext(item: TagModel, index: number) {
    return {
      $implicit: item, item, index, display: this.display(item), removable: this.canRemove(),
      remove: () => void this.remove(index)
    };
  }

  protected dropdownItemContext(item: TagModel, index: number) {
    return { $implicit: item, item, index, display: this.display(item) };
  }

  // ---------------------------------------------------------------- input events

  protected onInput(event: Event) {
    const text = (event.target as HTMLInputElement).value;
    this.inputText.set(text);
    this.errors.set([]);
    this.dropdownOpen.set(true);
    this.resetActive();
    clearTimeout(this.textTimer);
    this.textTimer = setTimeout(() => {
      this.textChange.emit(text);
      this.fetch(text);
    }, this.textChangeDebounce());
  }

  protected onInputKeydown(event: KeyboardEvent) {
    if (this.dropdownVisible()) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          this.moveActive(1);
          return;
        case 'ArrowUp':
          event.preventDefault();
          this.moveActive(-1);
          return;
        case 'Escape':
          this.dropdownOpen.set(false);
          return;
      }
    }
    if (event.key === 'Enter' || this.isSeparator(event)) {
      event.preventDefault();
      const suggestion = event.key === 'Enter' && this.dropdownVisible()
        ? this.suggestions()[this.activeIndex()]
        : undefined;
      if (suggestion === undefined) {
        void this.add(this.inputText());
      } else {
        this.selectSuggestion(suggestion);
      }
      return;
    }
    const field = event.target as HTMLInputElement;
    const atStart = field.selectionStart === 0 && field.selectionEnd === 0;
    if ((event.key === 'Backspace' || event.key === 'ArrowLeft') && atStart && this.value().length) {
      event.preventDefault();
      this.chipKeyboard.focus(this.value().length - 1);
    }
  }

  protected onFocus() {
    this.dropdownOpen.set(true);
    this.resetActive();
    this.fetch(this.inputText());
    this.focused.emit(this.inputText());
  }

  protected onBlur() {
    this.dropdownOpen.set(false);
    const text = this.inputText();
    if (this.addOnBlur() && text) {
      void this.add(text);
    } else if (this.clearOnBlur()) {
      this.clearText();
    }
    this.onTouched();
    this.blurred.emit(text);
  }

  protected async onPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text') ?? '';
    this.pasted.emit(text);
    if (!this.addOnPaste()) {
      return;
    }
    event.preventDefault();
    for (const part of text.split(this.pasteSplitPattern())) {
      await this.add(part);
    }
  }

  protected selectSuggestion(item: TagModel) {
    void this.add(item, true).then(added => {
      if (added && !this.keepOpen()) {
        this.dropdownOpen.set(false);
      }
      this.resetActive();
    });
  }

  // ---------------------------------------------------------------- chip events

  protected onChipKeydown(event: KeyboardEvent, index: number) {
    this.chipKeyboard.keydown(event, index);
  }

  protected startEdit(index: number) {
    if (!this.editable() || !this.interactive()) {
      return;
    }
    this.editingIndex.set(index);
    afterNextRender({
      write: () => {
        const field = this.editInput()?.nativeElement;
        if (field) {
          field.focus();
          field.select();
        }
      }
    }, { injector: this.injector });
  }

  protected onEditKeydown(event: KeyboardEvent, index: number) {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      void this.commitEdit(index, (event.target as HTMLInputElement).value);
    } else if (event.key === 'Escape') {
      this.editingIndex.set(-1);
      this.chipKeyboard.focus(index);
    }
  }

  protected async commitEdit(index: number, raw: string) {
    if (this.editingIndex() !== index) {
      return;
    }
    this.editingIndex.set(-1);
    const old = this.value()[index];
    const text = this.trimTags() ? raw.trim() : raw;
    if (text === this.display(old)) {
      return;
    }
    if (text === '') {
      await this.remove(index);
      return;
    }
    const tag: TagModel = typeof old === 'string'
      ? text
      : { ...old, [this.displayBy()]: text, [this.identifyBy()]: text };
    const duplicate = this.value().some((t, i) => i !== index && this.identify(t) === this.identify(tag));
    if ((duplicate && !this.allowDupes()) || !(await this.passesValidation(tag)) || this.destroyed) {
      return;
    }
    this.update(this.value().map((t, i) => (i === index ? tag : t)));
    this.tagEdited.emit(tag);
  }

  // ---------------------------------------------------------------- drag & drop (native HTML5)

  protected onDragStart(event: DragEvent, index: number) {
    const zone = this.dragZone();
    if (!zone || !this.interactive()) {
      event.preventDefault();
      return;
    }
    const item = this.value()[index];
    this.drag.current = { zone, item, index, source: this };
    event.dataTransfer?.setData('text/plain', this.display(item));
    this.draggingIndex.set(index);
  }

  protected onDragOver(event: DragEvent) {
    if (this.acceptsDrop()) {
      event.preventDefault();
    }
  }

  protected onDrop(event: DragEvent, index: number) {
    if (!this.acceptsDrop()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const { item, index: from, source } = this.drag.current!;
    this.drag.current = null;
    if (source === this) {
      const list = [...this.value()];
      list.splice(from, 1);
      list.splice(index > from ? index - 1 : index, 0, item);
      this.update(list);
    } else if (!this.maxReached() && (this.allowDupes() || this.indexOf(item) < 0)) {
      source.transferOut(from);
      const list = [...this.value()];
      list.splice(index, 0, item);
      this.update(list);
      this.added.emit(item);
    }
  }

  protected onDragEnd() {
    this.draggingIndex.set(-1);
    this.drag.current = null;
  }

  /** Removes a tag that was dragged into another input of the same zone. */
  transferOut(index: number) {
    const item = this.value()[index];
    this.update(this.value().filter((_, i) => i !== index));
    this.removed.emit(item);
  }

  // ---------------------------------------------------------------- ControlValueAccessor

  writeValue(value: TagModel[] | null): void {
    this.value.set(Array.isArray(value) ? [...value] : []);
  }

  // ---------------------------------------------------------------- internals

  private acceptsDrop() {
    const state = this.drag.current;
    return !!state && state.zone === this.dragZone() && this.interactive();
  }

  private update(tags: TagModel[]) {
    this.value.set(tags);
    this.tags.set(tags);
    this.onChange(tags);
  }

  private announce(text: string, tag: TagModel) {
    this.announcement.set(format(text, { label: this.display(tag) }));
  }

  /** Clears the text right away: keys typed before the next render must not land on the old text. */
  private clearText() {
    this.inputText.set('');
    const field = this.input()?.nativeElement;
    if (field) {
      field.value = '';
    }
  }

  private normalize(tag: TagModel): TagModel {
    if (this.modelAsStrings()) {
      return typeof tag === 'string' ? tag : String(this.identify(tag));
    }
    return typeof tag === 'string' ? { [this.identifyBy()]: tag, [this.displayBy()]: tag } : tag;
  }

  private indexOf(tag: TagModel) {
    const id = this.identify(tag);
    return this.value().findIndex(t => this.identify(t) === id);
  }

  private blink(index: number) {
    this.blinkIndex.set(index);
    setTimeout(() => this.blinkIndex.set(-1), 300);
  }

  private async passesValidation(tag: TagModel): Promise<boolean> {
    const control = new FormControl(this.display(tag));
    const sync = Validators.compose(this.validators());
    const async = Validators.composeAsync(this.asyncValidators());
    let errors = sync ? sync(control) : null;
    if (!errors && async) {
      errors = await firstValueFrom(from(async(control)));
    }
    const messages = this.errorMessages();
    this.errors.set(errors ? Object.keys(errors).map(key => messages[key]).filter((m): m is string => !!m) : []);
    if (errors) {
      this.validationError.emit(tag);
    }
    return !errors;
  }

  private async runHook(hook: TagHook | undefined, tag: TagModel): Promise<TagModel> {
    if (!hook) {
      return tag;
    }
    const result = hook(tag);
    return isObservable(result) ? firstValueFrom(result as Observable<TagModel>) : result;
  }

  private isSeparator(event: KeyboardEvent) {
    return this.separatorKeys().includes(event.key)
      || this.separatorKeyCodes().includes(event.keyCode)
      || (event.key === ' ' && !this.allowSpace());
  }

  private meetsMinimum(text: string) {
    return text.length >= this.minimumTextLength() || (text === '' && this.showDropdownIfEmpty());
  }

  private fetch(text: string) {
    const source = this.autocompleteObservable();
    if (!source || !this.meetsMinimum(text)) {
      return;
    }
    this.fetchSub?.unsubscribe();
    this.loading.set(true);
    this.fetchSub = source(text).subscribe({
      next: items => {
        this.remoteItems.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.remoteItems.set([]);
        this.loading.set(false);
      }
    });
  }

  private resetActive() {
    this.activeIndex.set(this.focusFirstElement() ? 0 : -1);
  }

  private moveActive(step: 1 | -1) {
    const count = this.suggestions().length;
    const next = Math.min(Math.max(this.activeIndex() + step, 0), count - 1);
    this.activeIndex.set(next);
    this.host.nativeElement.querySelector(`#${this.optionId(next)}`)?.scrollIntoView({ block: 'nearest' });
  }
}
