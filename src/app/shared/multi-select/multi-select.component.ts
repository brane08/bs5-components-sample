import {
  ChangeDetectionStrategy, Component, DOCUMENT, DoCheck, ElementRef, Injector, afterNextRender, booleanAttribute,
  computed, contentChild, effect, inject, input, linkedSignal, model, numberAttribute, output, signal, viewChild
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ControlValueAccessor, NgControl } from '@angular/forms';
import { CdkConnectedOverlay, ConnectedPosition } from '@angular/cdk/overlay';
import { CdkFixedSizeVirtualScroll, CdkVirtualForOf, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Subject, take } from 'rxjs';
import { closeButtonTheme, resolvePath } from '../util/bs-theme';
import {
  SelectFooterTemplate, SelectHeaderTemplate, SelectLabelTemplate, SelectLoadingTemplate, SelectMultiLabelTemplate,
  SelectNotFoundTemplate, SelectOptgroupTemplate, SelectOptionTemplate, SelectTagTemplate, SelectTypeToSearchTemplate
} from './select-templates';

export type DropdownPosition = 'bottom' | 'top' | 'auto';
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
  styleUrls: ['./multi-select.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, CdkConnectedOverlay, CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf],
  host: { 'class': 'd-block position-relative' }
})
export class MultiSelectComponent implements ControlValueAccessor, DoCheck {
  // ---- data
  readonly items = input<readonly any[] | null | undefined>([]);
  /** Property (dotted path allowed) used as label for object items. Defaults to `label`. */
  readonly bindLabel = input<string>();
  /** Property used as model value; the whole item when unset. */
  readonly bindValue = input<string>();
  readonly compareWith = input<CompareWithFn>((a, b) => a === b);
  readonly searchFn = input<SearchFn>();
  readonly groupBy = input<string | GroupByFn>();
  /** Clicking a group header (de)selects all its children. */
  readonly selectableGroup = input(false, { transform: booleanAttribute });

  // ---- behaviour
  readonly multiple = input(true, { transform: booleanAttribute });
  readonly searchable = input(true, { transform: booleanAttribute });
  readonly clearable = input(true, { transform: booleanAttribute });
  readonly clearOnBackspace = input(true, { transform: booleanAttribute });
  readonly clearSearchOnAdd = input(true, { transform: booleanAttribute });
  /** Defaults to `true` for single and `false` for multiple selection. */
  readonly closeOnSelect = input<boolean | undefined>(undefined);
  readonly hideSelected = input(false, { transform: booleanAttribute });
  /** 0 = unlimited. */
  readonly maxSelectedItems = input(0, { transform: numberAttribute });
  readonly markFirst = input(true, { transform: booleanAttribute });
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
  readonly placeholder = input('');
  readonly notFoundText = input('No items found');
  readonly typeToSearchText = input('Type to search');
  readonly addTagText = input('Add item');
  readonly loadingText = input('Loading...');
  readonly clearAllText = input('Clear all');
  readonly selectAllText = input('Select all');
  /** Bootstrap variant for chips (`text-bg-*`). */
  readonly type = input('secondary');
  readonly size = input<'sm' | 'lg' | undefined>();
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /** Row height in px used by virtual scroll. */
  readonly itemSize = input(32, { transform: numberAttribute });
  /** `'body'` renders the dropdown in a CDK overlay (escapes `overflow: hidden`, tables, modals). */
  readonly appendTo = input<'body' | null>(null);
  readonly dropdownPosition = input<DropdownPosition>('auto');
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
  /** Registered as value accessor here (instead of NG_VALUE_ACCESSOR) so the control state can drive `.is-invalid`. */
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly injector = inject(Injector);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly controlEl = viewChild.required<ElementRef<HTMLElement>>('control');
  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  protected readonly id = `app-select-${nextId++}`;
  protected readonly listboxId = `${this.id}-listbox`;
  protected readonly disabledState = linkedSignal(() => this.disabled());
  protected readonly searchTerm = signal('');
  /** Bootstrap's `.is-invalid` once the bound form control is invalid and touched. */
  protected readonly invalid = signal(false);
  protected readonly markedIndex = signal(-1);
  protected readonly openAbove = signal(false);
  protected readonly overlayWidth = signal(0);
  private readonly selection = signal<Selection[]>([]);
  private readonly addedItems = signal<any[]>([]);

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly interactive = computed(() => !this.disabledState() && !this.readonly());
  protected readonly closeTheme = computed(() => closeButtonTheme(`text-bg-${this.type()}`));
  private readonly effectiveCloseOnSelect = computed(() => this.closeOnSelect() ?? !this.multiple());

  readonly allItems = computed(() => [...(this.items() ?? []), ...this.addedItems()]);

  readonly selectedItems = computed(() => this.selection().map(s => s.item ?? this.findByValue(s.value) ?? s.value));
  readonly selectedValues = computed(() => this.selection().map(s => s.value));
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

  protected readonly allFilteredSelected = computed(() => {
    const items = this.filteredItems();
    return items.length > 0 && items.every(item => this.isSelected(item));
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
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
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
    const control = this.ngControl;
    this.invalid.set(control?.invalid === true && control.touched === true);
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
    const compare = this.compareWith();
    return this.selection().some(s => compare(value, s.value));
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
    if (event.target !== this.input().nativeElement) {
      event.preventDefault();
    }
    if (!this.interactive()) {
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
    this.onTouched();
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
    }
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

  protected onChipRemove(item: any, event: Event) {
    event.stopPropagation();
    this.unselect(item);
  }

  protected toggleSelectAll() {
    if (!this.interactive()) {
      return;
    }
    const items = this.filteredItems();
    if (this.allFilteredSelected()) {
      items.forEach(item => this.unselect(item));
    } else {
      items.filter(item => !this.isSelected(item)).forEach(item => this.select(item));
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
    const values = this.multiple()
      ? (Array.isArray(value) ? value : [])
      : (value == null ? [] : [value]);
    this.selection.set(values.map(v => ({ value: v })));
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
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
    const compare = this.compareWith();
    return this.allItems().find(item => compare(this.valueOf(item), value));
  }

  private isItemDisabled(item: any, selected: boolean) {
    return (item != null && typeof item === 'object' && item.disabled === true) || (!selected && this.maxReached());
  }

  private afterChange() {
    const items = this.selectedItems();
    const values = this.selectedValues();
    this.onChange(this.multiple() ? values : (values[0] ?? null));
    this.change.emit(this.multiple() ? items : (items[0] ?? null));
  }

  private toggleGroup(row: GroupRow) {
    if (!this.selectableGroup() || !this.multiple()) {
      return;
    }
    if (row.selected) {
      row.items.forEach(item => this.unselect(item));
    } else {
      row.items.filter(item => !this.isSelected(item)).forEach(item => this.select(item));
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
    const next = this.nextNavigable(this.markedIndex(), step);
    if (next >= 0) {
      this.markedIndex.set(next);
      this.scrollToRow(next);
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
