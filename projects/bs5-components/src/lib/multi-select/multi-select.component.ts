import {
  ChangeDetectionStrategy, Component, DOCUMENT, DoCheck, ElementRef, Injector, afterNextRender, booleanAttribute,
  computed, contentChild, effect, inject, input, linkedSignal, model, numberAttribute, output, signal, viewChild
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ControlValueAccessor } from '@angular/forms';
import { CdkConnectedOverlay, ConnectedPosition } from '@angular/cdk/overlay';
import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Subject, take } from 'rxjs';
import { FormControlBridge } from '../core/form-control-bridge';
import { ChipKeyboard } from '../core/chip-keyboard';
import { ChipComponent } from '../core/chip.component';
import { format } from '../core/format';
import { resolvePath } from '../util/bs-theme';
import { DropdownPosition, SELECT_CONFIG } from './select.config';
import {
  SelectFooterTemplate, SelectHeaderTemplate, SelectLabelTemplate, SelectLoadingTemplate, SelectMultiLabelTemplate,
  SelectNotFoundTemplate, SelectOptgroupTemplate, SelectOptionTemplate, SelectTagTemplate, SelectTypeToSearchTemplate
} from './select-templates';

export type { DropdownPosition } from './select.config';
export type AddTagFn = (term: string) => any | Promise<any>;
export type GroupByFn = (item: any) => unknown;
export type SearchFn = (term: string, item: any) => boolean;
export type CompareWithFn = (optionValue: any, modelValue: any) => boolean;

type OptionRow = { kind: 'option'; item: any; selected: boolean; disabled: boolean };
type GroupRow = { kind: 'group'; key: unknown; label: string; items: any[]; selected: boolean; disabled: boolean };
type TagRow = { kind: 'tag'; term: string; selected: false; disabled: false };
export type SelectRow = OptionRow | GroupRow | TagRow;

/** A selection entry; `item` is unknown when the value was written before items arrived. */
interface Selection { value: any; item?: any }

const PANEL_MAX_HEIGHT = 240;
/** How long typed characters are combined when jumping to an option (non-searchable select). */
const TYPE_AHEAD_RESET_MS = 500;
/** Default compareWith; lets selection lookups use a Set instead of scanning. */
const IDENTITY: CompareWithFn = (a, b) => a === b;
let nextId = 0;

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Bootstrap 5 select with ng-select's feature set: single/multiple, search, custom templates, option groups,
 * typeahead (async) search, tagging, virtual scroll, append-to-body, select all and ControlValueAccessor.
 */
@Component({
  selector: 'app-multi-select',
  templateUrl: './multi-select.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet, ChipComponent, CdkConnectedOverlay, CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll,
    CdkVirtualForOf
  ],
  host: { 'class': 'd-block position-relative' }
})
export class MultiSelectComponent implements ControlValueAccessor, DoCheck {
  private readonly config = inject(SELECT_CONFIG);
  private readonly form = new FormControlBridge<any>(this);

  // ---- data
  readonly items = input<readonly any[] | null | undefined>([]);
  /** Property (dotted path allowed) used as label for object items. Defaults to `label`. */
  readonly bindLabel = input<string>();
  /** Property used as model value; the whole item when unset. */
  readonly bindValue = input<string>();
  readonly compareWith = input<CompareWithFn>(IDENTITY);
  readonly searchFn = input<SearchFn>();
  readonly groupBy = input<string | GroupByFn>();
  /** Clicking a group header (de)selects all its children. */
  readonly selectableGroup = input(false, { transform: booleanAttribute });

  // ---- behaviour
  readonly multiple = input(true, { transform: booleanAttribute });
  readonly searchable = input(this.config.searchable, { transform: booleanAttribute });
  readonly clearable = input(this.config.clearable, { transform: booleanAttribute });
  readonly clearOnBackspace = input(true, { transform: booleanAttribute });
  readonly clearSearchOnAdd = input(this.config.clearSearchOnAdd, { transform: booleanAttribute });
  /** Defaults to `true` for single and `false` for multiple selection. */
  readonly closeOnSelect = input<boolean | undefined>(undefined);
  readonly hideSelected = input(false, { transform: booleanAttribute });
  /** 0 = unlimited. */
  readonly maxSelectedItems = input(0, { transform: numberAttribute });
  readonly markFirst = input(this.config.markFirst, { transform: booleanAttribute });
  readonly selectOnTab = input(false, { transform: booleanAttribute });
  readonly openOnEnter = input(true, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly showSelectAll = input(false, { transform: booleanAttribute });
  /** `true` adds the search term as `{[bindLabel]: term}` (or the plain string); a function may return a Promise. */
  readonly addTag = input<boolean | AddTagFn>(false);
  /** Search terms are pushed here instead of filtering locally (async/server search). */
  readonly typeahead = input<Subject<string>>();
  readonly minTermLength = input(0, { transform: numberAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  /** Return `false` to skip the default key handling. */
  readonly keyDownFn = input<(event: KeyboardEvent) => boolean | void>();

  // ---- rendering
  readonly placeholder = input(this.config.placeholder);
  readonly notFoundText = input(this.config.notFoundText);
  readonly typeToSearchText = input(this.config.typeToSearchText);
  readonly addTagText = input(this.config.addTagText);
  readonly loadingText = input(this.config.loadingText);
  readonly clearAllText = input(this.config.clearAllText);
  readonly selectAllText = input(this.config.selectAllText);
  readonly removeItemText = input(this.config.removeItemText);
  readonly selectedText = input(this.config.selectedText);
  readonly deselectedText = input(this.config.deselectedText);
  readonly clearedText = input(this.config.clearedText);
  /** Bootstrap variant for chips (`text-bg-*`). */
  readonly type = input(this.config.type);
  readonly size = input<'sm' | 'lg' | undefined>();
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /** Row height in px used by virtual scroll. */
  readonly itemSize = input(this.config.itemSize, { transform: numberAttribute });
  /** `'body'` renders the dropdown in a CDK overlay (escapes `overflow: hidden`, tables, modals). */
  readonly appendTo = input<'body' | null>(this.config.appendTo);
  readonly dropdownPosition = input<DropdownPosition>(this.config.dropdownPosition);
  /** Id for the inner input, so `<label for>` works. */
  readonly labelForId = input<string>();
  readonly isOpen = model(false);

  // ---- outputs
  readonly openEvent = output<void>({ alias: 'open' });
  readonly closeEvent = output<void>({ alias: 'close' });
  readonly focusEvent = output<FocusEvent>({ alias: 'focus' });
  readonly blurEvent = output<FocusEvent>({ alias: 'blur' });
  readonly search = output<{ term: string; items: any[] }>();
  readonly clear = output<void>();
  readonly add = output<any>();
  readonly remove = output<any>();
  /** Selected item(s): an array for multiple, the item or null for single. */
  readonly change = output<any>();
  readonly scroll = output<{ start: number; end: number }>();
  readonly scrollToEnd = output<void>();

  // ---- templates
  protected readonly optionTpl = contentChild(SelectOptionTemplate);
  protected readonly labelTpl = contentChild(SelectLabelTemplate);
  protected readonly multiLabelTpl = contentChild(SelectMultiLabelTemplate);
  protected readonly optgroupTpl = contentChild(SelectOptgroupTemplate);
  protected readonly headerTpl = contentChild(SelectHeaderTemplate);
  protected readonly footerTpl = contentChild(SelectFooterTemplate);
  protected readonly notFoundTpl = contentChild(SelectNotFoundTemplate);
  protected readonly loadingTpl = contentChild(SelectLoadingTemplate);
  protected readonly typeToSearchTpl = contentChild(SelectTypeToSearchTemplate);
  protected readonly tagTpl = contentChild(SelectTagTemplate);

  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly chipKeyboard = new ChipKeyboard(this.host, this.injector, {
    removeChip: index => this.removeChipAt(index),
    focusInput: () => this.focus()
  });
  private typeAheadBuffer = '';
  private typeAheadTimer?: ReturnType<typeof setTimeout>;
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly controlEl = viewChild.required<ElementRef<HTMLElement>>('control');
  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  protected readonly id = `app-select-${nextId++}`;
  protected readonly listboxId = `${this.id}-listbox`;
  protected readonly disabledState = linkedSignal(() => this.disabled());
  /** Bootstrap's `.is-invalid` once the bound form control is invalid and touched. */
  protected readonly invalid = this.form.invalid;
  protected readonly searchTerm = signal('');
  /** Text of the visually hidden live region (screen-reader announcements). */
  protected readonly announcement = signal('');
  protected readonly markedIndex = signal(-1);
  protected readonly openAbove = signal(false);
  protected readonly overlayWidth = signal(0);
  private readonly selection = signal<Selection[]>([]);
  private readonly addedItems = signal<any[]>([]);

  protected readonly interactive = computed(() => !this.disabledState() && !this.readonly());
  private readonly effectiveCloseOnSelect = computed(() => this.closeOnSelect() ?? !this.multiple());

  readonly allItems = computed(() => [...(this.items() ?? []), ...this.addedItems()]);

  /** value -> first item with that value; only for the default (identity) compareWith. */
  private readonly itemsByValue = computed(() => {
    if (this.compareWith() !== IDENTITY) {
      return null;
    }
    const map = new Map<unknown, any>();
    for (const item of this.allItems()) {
      const value = this.valueOf(item);
      if (!map.has(value)) {
        map.set(value, item);
      }
    }
    return map;
  });

  readonly selectedItems = computed(() => this.selection().map(s => s.item ?? this.findByValue(s.value) ?? s.value));
  readonly selectedValues = computed(() => this.selection().map(s => s.value));
  /** Selected values as a Set, for O(1) lookups with the default compareWith. */
  private readonly selectedSet = computed(() =>
    this.compareWith() === IDENTITY ? new Set(this.selectedValues()) : null);
  protected readonly hasValue = computed(() => this.selection().length > 0);
  private readonly maxReached = computed(() =>
    this.multiple() && this.maxSelectedItems() > 0 && this.selection().length >= this.maxSelectedItems());

  /** Typeahead is active and the term is still too short. */
  protected readonly needsMoreTerm = computed(() =>
    !!this.typeahead() && this.searchTerm().length < this.minTermLength());

  readonly filteredItems = computed(() => {
    const term = this.searchTerm();
    let list = this.allItems();
    if (term && !this.typeahead()) {
      const fn = this.searchFn();
      const needle = normalize(term);
      list = list.filter(item => fn ? fn(term, item) : normalize(this.label(item)).includes(needle));
    }
    if (this.hideSelected() && this.multiple()) {
      list = list.filter(item => !this.isSelected(item));
    }
    return list;
  });

  protected readonly showAddTag = computed(() => {
    const term = this.searchTerm().trim();
    if (!this.addTag() || !term || this.loading()) {
      return false;
    }
    const needle = term.toLowerCase();
    return !this.allItems().some(item => this.label(item).toLowerCase() === needle);
  });

  readonly rows = computed<SelectRow[]>(() => {
    const rows: SelectRow[] = [];
    if (this.showAddTag()) {
      rows.push({ kind: 'tag', term: this.searchTerm().trim(), selected: false, disabled: false });
    }
    if (this.needsMoreTerm()) {
      return rows;
    }
    const groupBy = this.groupBy();
    const toRow = (item: any): OptionRow => {
      const selected = this.isSelected(item);
      return { kind: 'option', item, selected, disabled: this.isItemDisabled(item, selected) };
    };
    if (!groupBy) {
      return rows.concat(this.filteredItems().map(toRow));
    }
    const groups = new Map<unknown, any[]>();
    for (const item of this.filteredItems()) {
      const key = typeof groupBy === 'function' ? groupBy(item) : resolvePath(item, groupBy);
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const [key, items] of groups) {
      const options = items.map(toRow);
      const selectable = options.filter(o => !o.disabled || o.selected);
      rows.push({
        kind: 'group',
        key,
        label: key != null && typeof key === 'object' ? this.label(key) : String(key ?? ''),
        items,
        selected: selectable.length > 0 && selectable.every(o => o.selected),
        disabled: !this.selectableGroup()
      });
      rows.push(...options);
    }
    return rows;
  });

  /** Filtered options that can be selected at all (not `disabled`). */
  private readonly selectableItems = computed(() => this.filteredItems().filter(item => !this.isDisabledItem(item)));

  /**
   * "Select all" is checked when every selectable option is selected, or when no more can be selected (max reached)
   * and at least one of them is.
   */
  protected readonly allFilteredSelected = computed(() => {
    const items = this.selectableItems();
    const selected = items.filter(item => this.isSelected(item)).length;
    return selected > 0 && (selected === items.length || this.maxReached());
  });
  protected readonly someFilteredSelected = computed(() =>
    !this.allFilteredSelected() && this.filteredItems().some(item => this.isSelected(item)));

  protected readonly markedId = computed(() =>
    this.isOpen() && this.markedIndex() >= 0 ? this.rowId(this.markedIndex()) : null);

  protected readonly overlayPositions = computed<ConnectedPosition[]>(() => {
    const below: ConnectedPosition = { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 2 };
    const above: ConnectedPosition = { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -2 };
    switch (this.dropdownPosition()) {
      case 'top': return [above];
      case 'bottom': return [below];
      default: return [below, above];
    }
  });

  protected readonly viewportHeight = computed(() =>
    Math.min(this.rows().length * this.itemSize(), PANEL_MAX_HEIGHT));

  constructor() {
    // Keep a valid marked row while the list changes.
    effect(() => {
      const rows = this.rows();
      if (!this.isOpen()) {
        return;
      }
      const current = this.markedIndex();
      if (current >= rows.length || (current >= 0 && !this.isNavigable(rows[current]))) {
        this.markedIndex.set(this.markFirst() ? this.nextNavigable(-1, 1, rows) : -1);
      }
    });
  }

  ngDoCheck() {
    this.form.check();
  }

  // ---------------------------------------------------------------- public API (ng-select compatible)

  open() {
    if (!this.interactive() || this.isOpen()) {
      return;
    }
    this.updatePlacement();
    this.isOpen.set(true);
    this.markedIndex.set(this.initialMark());
    afterNextRender({ read: () => this.revealMarked() }, { injector: this.injector });
    this.openEvent.emit();
  }

  close() {
    if (!this.isOpen()) {
      return;
    }
    this.isOpen.set(false);
    this.markedIndex.set(-1);
    if (this.searchTerm()) {
      this.searchTerm.set('');
    }
    this.closeEvent.emit();
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  focus() {
    this.input().nativeElement.focus();
  }

  blur() {
    this.input().nativeElement.blur();
  }

  /** Sets the search term programmatically. */
  filter(term: string) {
    this.searchTerm.set(term);
    this.typeahead()?.next(term);
    this.open();
  }

  select(item: any) {
    if (!this.interactive() || this.isItemDisabled(item, this.isSelected(item))) {
      return;
    }
    const value = this.valueOf(item);
    if (this.multiple()) {
      if (this.isSelected(item)) {
        return;
      }
      this.selection.update(list => [...list, { value, item }]);
    } else {
      this.selection.set([{ value, item }]);
    }
    this.add.emit(item);
    this.afterChange();
    this.announce(this.selectedText(), item);
    if (this.clearSearchOnAdd() && this.searchTerm()) {
      this.searchTerm.set('');
    }
    if (this.effectiveCloseOnSelect()) {
      this.close();
    }
  }

  unselect(item: any) {
    if (!this.interactive()) {
      return;
    }
    const value = this.valueOf(item);
    const before = this.selection();
    const after = before.filter(s => !this.compareWith()(value, s.value));
    if (after.length !== before.length) {
      this.selection.set(after);
      this.remove.emit(item);
      this.afterChange();
      this.announce(this.deselectedText(), item);
    }
  }

  /** Clears the selection and the search term. */
  clearModel() {
    if (!this.interactive()) {
      return;
    }
    this.searchTerm.set('');
    if (this.hasValue()) {
      this.selection.set([]);
      this.afterChange();
      this.announcement.set(this.clearedText());
    }
    this.clear.emit();
  }

  // ---------------------------------------------------------------- helpers used by the template

  label(item: any): string {
    if (item == null) {
      return '';
    }
    if (typeof item !== 'object') {
      return String(item);
    }
    const label = resolvePath(item, this.bindLabel() ?? 'label');
    return label == null ? '' : String(label);
  }

  isSelected(item: any): boolean {
    const value = this.valueOf(item);
    const set = this.selectedSet();
    if (set) {
      return set.has(value);
    }
    const compare = this.compareWith();
    return this.selection().some(s => compare(value, s.value));
  }

  protected removeLabel(item: any) {
    return format(this.removeItemText(), { label: this.label(item) });
  }

  protected rowId(index: number) {
    return `${this.id}-row-${index}`;
  }

  protected optionContext(row: OptionRow, index: number) {
    return {
      $implicit: row.item, item: row.item, index, searchTerm: this.searchTerm(),
      selected: row.selected, disabled: row.disabled
    };
  }

  protected labelContext(item: any) {
    return { $implicit: item, item, clear: () => this.unselect(item) };
  }

  protected multiLabelContext() {
    const items = this.selectedItems();
    return { $implicit: items, items, clear: (item: any) => this.unselect(item) };
  }

  protected groupContext(row: GroupRow) {
    return { $implicit: row.key, label: row.label, items: row.items, selected: row.selected };
  }

  protected searchContext() {
    const term = this.searchTerm();
    return { $implicit: term, searchTerm: term };
  }

  // ---------------------------------------------------------------- event handlers

  protected onControlMouseDown(event: MouseEvent) {
    // Right/middle clicks keep their default behaviour and never toggle the panel.
    if (event.button !== 0) {
      return;
    }
    if (event.target !== this.input().nativeElement) {
      event.preventDefault();
    }
    // Chip remove and clear buttons handle their own click.
    if (!this.interactive() || (event.target as HTMLElement).closest('.btn-close')) {
      return;
    }
    this.focus();
    this.toggle();
  }

  protected onInput(event: Event) {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerm.set(term);
    const typeahead = this.typeahead();
    if (typeahead && term.length >= this.minTermLength()) {
      typeahead.next(term);
    }
    this.open();
    this.markedIndex.set(this.initialMark());
    this.search.emit({ term, items: this.filteredItems() });
  }

  protected onFocus(event: FocusEvent) {
    this.focusEvent.emit(event);
  }

  protected onBlur(event: FocusEvent) {
    this.close();
    this.form.onTouched();
    this.blurEvent.emit(event);
  }

  protected onKeydown(event: KeyboardEvent) {
    if (this.keyDownFn()?.(event) === false || !this.interactive()) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.isOpen() ? this.moveMark(1) : this.open();
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (this.isOpen()) {
          this.moveMark(-1);
        }
        break;
      case 'Enter':
        if (this.isOpen()) {
          event.preventDefault();
          this.activateMarked();
        } else if (this.openOnEnter()) {
          event.preventDefault();
          this.open();
        }
        break;
      case ' ':
        if (!this.searchable()) {
          event.preventDefault();
          this.isOpen() ? this.activateMarked() : this.open();
        }
        break;
      case 'Tab':
        if (this.isOpen() && this.selectOnTab() && this.markedIndex() >= 0) {
          this.activateMarked();
        }
        this.close();
        break;
      case 'Escape':
        if (this.isOpen()) {
          event.stopPropagation();
          this.close();
        }
        break;
      case 'Home':
      case 'End':
        if (this.isOpen()) {
          event.preventDefault();
          const rows = this.rows();
          this.markRow(event.key === 'Home' ? this.nextNavigable(-1, 1, rows) : this.nextNavigable(rows.length, -1, rows));
        }
        break;
      case 'PageDown':
      case 'PageUp':
        if (this.isOpen()) {
          event.preventDefault();
          this.movePage(event.key === 'PageDown' ? 1 : -1);
        }
        break;
      case 'ArrowLeft': {
        const field = event.target as HTMLInputElement;
        if (this.multiple() && this.hasValue() && field.selectionStart === 0 && field.selectionEnd === 0) {
          event.preventDefault();
          this.chipKeyboard.focus(this.selection().length - 1);
        }
        break;
      }
      case 'Backspace':
        if (!this.searchTerm() && this.clearable() && this.clearOnBackspace() && this.hasValue()) {
          if (this.multiple()) {
            const items = this.selectedItems();
            this.unselect(items[items.length - 1]);
          } else {
            this.clearModel();
          }
        }
        break;
      default:
        if (!this.searchable() && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          this.typeAhead(event.key);
        }
    }
  }

  protected onChipKeydown(event: KeyboardEvent, index: number) {
    this.chipKeyboard.keydown(event, index);
  }

  protected onRowClick(row: SelectRow, event?: Event) {
    event?.stopPropagation();
    switch (row.kind) {
      case 'tag':
        this.createTag(row.term);
        break;
      case 'group':
        this.toggleGroup(row);
        break;
      default:
        if (row.disabled) {
          return;
        }
        if (this.multiple() && row.selected) {
          this.unselect(row.item);
        } else {
          this.select(row.item);
        }
    }
  }

  protected onRowHover(index: number) {
    if (this.isNavigable(this.rows()[index])) {
      this.markedIndex.set(index);
    }
  }

  protected onClearClick(event: Event) {
    event.stopPropagation();
    this.clearModel();
    this.focus();
  }

  protected toggleSelectAll() {
    if (!this.interactive()) {
      return;
    }
    const items = this.filteredItems();
    if (this.allFilteredSelected()) {
      this.unselectMany(items);
    } else {
      this.selectMany(items);
    }
  }

  protected onPanelScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (this.virtualScroll()) {
      const start = Math.floor(el.scrollTop / this.itemSize());
      const end = Math.min(this.rows().length, Math.ceil((el.scrollTop + el.clientHeight) / this.itemSize()));
      this.scroll.emit({ start, end });
    }
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
      this.scrollToEnd.emit();
    }
  }

  protected onOverlayDetach() {
    this.close();
  }

  // ---------------------------------------------------------------- ControlValueAccessor

  writeValue(value: any): void {
    clearTimeout(this.typeAheadTimer);
    const values = this.multiple()
      ? (Array.isArray(value) ? value : [])
      : (value == null ? [] : [value]);
    this.selection.set(values.map(v => ({ value: v })));
  }

  registerOnChange(fn: (value: any) => void): void {
    this.form.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.form.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledState.set(isDisabled);
    if (isDisabled) {
      this.close();
    }
  }

  // ---------------------------------------------------------------- internals

  private valueOf(item: any) {
    const key = this.bindValue();
    return key && item != null && typeof item === 'object' ? resolvePath(item, key) : item;
  }

  private findByValue(value: any) {
    const map = this.itemsByValue();
    if (map) {
      return map.get(value);
    }
    const compare = this.compareWith();
    return this.allItems().find(item => compare(this.valueOf(item), value));
  }

  private announce(text: string, item: any) {
    this.announcement.set(format(text, { label: this.label(item) }));
  }

  /** Selects several items with a single model update (select all, group headers). */
  private selectMany(items: any[]) {
    const max = this.maxSelectedItems();
    const additions: Selection[] = [];
    const seen = new Set<unknown>();
    for (const item of items) {
      if (max > 0 && this.selection().length + additions.length >= max) {
        break;
      }
      const value = this.valueOf(item);
      if (!this.isDisabledItem(item) && !this.isSelected(item) && !seen.has(value)) {
        seen.add(value);
        additions.push({ value, item });
      }
    }
    if (additions.length) {
      this.selection.update(list => [...list, ...additions]);
      additions.forEach(a => this.add.emit(a.item));
      this.afterChange();
      this.announcement.set(format(this.selectedText(), { label: String(additions.length) }));
    }
  }

  /** Unselects several items with a single model update. */
  private unselectMany(items: any[]) {
    const compare = this.compareWith();
    const byValue = compare === IDENTITY ? new Map(items.map(item => [this.valueOf(item), item])) : null;
    const matchOf = (value: unknown) =>
      byValue ? byValue.get(value) : items.find(item => compare(this.valueOf(item), value));
    const removed: any[] = [];
    const kept = this.selection().filter(s => {
      const item = matchOf(s.value);
      if (item !== undefined) {
        removed.push(item);
      }
      return item === undefined;
    });
    // Only called when at least one of `items` is selected ("select all" checked or a selected group).
    this.selection.set(kept);
    removed.forEach(item => this.remove.emit(item));
    this.afterChange();
    this.announcement.set(format(this.deselectedText(), { label: String(removed.length) }));
  }

  private removeChipAt(index: number): boolean {
    const item = this.selectedItems()[index];
    if (!this.interactive() || item === undefined) {
      return false;
    }
    this.unselect(item);
    return true;
  }

  private isDisabledItem(item: any) {
    return item != null && typeof item === 'object' && item.disabled === true;
  }

  private isItemDisabled(item: any, selected: boolean) {
    return this.isDisabledItem(item) || (!selected && this.maxReached());
  }

  private afterChange() {
    const items = this.selectedItems();
    const values = this.selectedValues();
    this.form.onChange(this.multiple() ? values : (values[0] ?? null));
    this.change.emit(this.multiple() ? items : (items[0] ?? null));
  }

  private toggleGroup(row: GroupRow) {
    if (!this.selectableGroup() || !this.multiple()) {
      return;
    }
    if (row.selected) {
      this.unselectMany(row.items);
    } else {
      this.selectMany(row.items);
    }
  }

  private createTag(term: string) {
    const addTag = this.addTag();
    const created = typeof addTag === 'function'
      ? addTag(term)
      : (this.bindLabel() ? { [this.bindLabel()!]: term } : term);
    Promise.resolve(created).then(item => {
      if (item == null) {
        return;
      }
      this.addedItems.update(list => [...list, item]);
      this.select(item);
      this.searchTerm.set('');
    });
  }

  private isNavigable(row: SelectRow): boolean {
    if (row.kind === 'group') {
      return this.selectableGroup() && this.multiple();
    }
    return !row.disabled;
  }

  private nextNavigable(from: number, step: 1 | -1, rows = this.rows()): number {
    for (let i = from + step; i >= 0 && i < rows.length; i += step) {
      if (this.isNavigable(rows[i])) {
        return i;
      }
    }
    return -1;
  }

  private initialMark(): number {
    const rows = this.rows();
    const selectedIndex = rows.findIndex(r => r.kind === 'option' && r.selected && !this.multiple());
    if (selectedIndex >= 0) {
      return selectedIndex;
    }
    return this.markFirst() ? this.nextNavigable(-1, 1, rows) : -1;
  }

  private moveMark(step: 1 | -1) {
    this.markRow(this.nextNavigable(this.markedIndex(), step));
  }

  private markRow(index: number) {
    if (index >= 0) {
      this.markedIndex.set(index);
      this.scrollToRow(index);
    }
  }

  /** PageUp/PageDown: move by one panel height of navigable rows, stopping at the ends. */
  private movePage(step: 1 | -1) {
    const rows = this.rows();
    let index = this.markedIndex();
    for (let n = Math.max(1, Math.floor(PANEL_MAX_HEIGHT / this.itemSize())); n > 0; n--) {
      const next = this.nextNavigable(index, step, rows);
      if (next < 0) {
        break;
      }
      index = next;
    }
    this.markRow(index);
  }

  /** Non-searchable select: typed characters jump to the next option starting with them. */
  private typeAhead(char: string) {
    clearTimeout(this.typeAheadTimer);
    this.typeAheadBuffer += char.toLowerCase();
    this.typeAheadTimer = setTimeout(() => (this.typeAheadBuffer = ''), TYPE_AHEAD_RESET_MS);
    this.open();
    const rows = this.rows();
    const start = this.typeAheadBuffer.length > 1 ? this.markedIndex() : this.markedIndex() + 1;
    for (let i = 0; i < rows.length; i++) {
      const index = (Math.max(start, 0) + i) % rows.length;
      const row = rows[index];
      if (row.kind === 'option' && !row.disabled && this.label(row.item).toLowerCase().startsWith(this.typeAheadBuffer)) {
        this.markRow(index);
        return;
      }
    }
  }

  private activateMarked() {
    const row = this.rows()[this.markedIndex()];
    if (row) {
      this.onRowClick(row);
    }
  }

  private scrollToRow(index: number) {
    const viewport = this.viewport();
    if (viewport) {
      const size = this.itemSize();
      const offset = viewport.measureScrollOffset();
      const height = viewport.getViewportSize();
      if (index * size < offset) {
        viewport.scrollToOffset(index * size);
      } else if ((index + 1) * size > offset + height) {
        viewport.scrollToOffset((index + 1) * size - height);
      }
      return;
    }
    // The row is not rendered yet when keys are pressed faster than change detection runs.
    this.document.getElementById(this.rowId(index))?.scrollIntoView({ block: 'nearest' });
  }

  /** Brings the marked (e.g. selected) row into view once the panel is rendered. */
  private revealMarked() {
    const index = this.markedIndex();
    if (index < 0) {
      return;
    }
    const viewport = this.viewport();
    if (viewport) {
      // The viewport knows its content size only after the first range is rendered.
      viewport.renderedRangeStream.pipe(take(1)).subscribe(() =>
        afterNextRender({ write: () => viewport.scrollToIndex(index) }, { injector: this.injector }));
    } else {
      this.scrollToRow(index);
    }
  }

  private updatePlacement() {
    const rect = this.controlEl().nativeElement.getBoundingClientRect();
    this.overlayWidth.set(rect.width);
    const position = this.dropdownPosition();
    if (position === 'auto') {
      const below = window.innerHeight - rect.bottom;
      this.openAbove.set(below < PANEL_MAX_HEIGHT && rect.top > below);
    } else {
      this.openAbove.set(position === 'top');
    }
  }
}
