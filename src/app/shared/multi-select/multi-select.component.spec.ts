import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { Subject } from 'rxjs';
import { MultiSelectComponent } from './multi-select.component';
import {
  SELECT_TEMPLATES, SelectFooterTemplate, SelectHeaderTemplate, SelectLabelTemplate, SelectLoadingTemplate,
  SelectMultiLabelTemplate, SelectNotFoundTemplate, SelectOptgroupTemplate, SelectOptionTemplate, SelectTagTemplate,
  SelectTypeToSearchTemplate
} from './select-templates';

interface Lang {
  id: number;
  name: string;
  kind: string;
  disabled?: boolean;
}

const LANGS: Lang[] = [
  { id: 1, name: 'Java', kind: 'Static' },
  { id: 2, name: 'Python', kind: 'Dynamic' },
  { id: 3, name: 'TypeScript', kind: 'Static' },
  { id: 4, name: 'Café', kind: 'Dynamic', disabled: true }
];

describe('MultiSelectComponent', () => {
  let fixture: ComponentFixture<MultiSelectComponent>;
  let comp: MultiSelectComponent;
  let el: HTMLElement;

  const input = () => el.querySelector<HTMLInputElement>('input.ms-input')!;
  const control = () => el.querySelector<HTMLElement>('.ms-control')!;
  const rowEls = () => Array.from(document.querySelectorAll<HTMLElement>('.ms-panel .dropdown-item, .ms-panel .dropdown-header'))
    .filter(r => !r.classList.contains('ms-select-all'));
  const optionEls = () => Array.from(document.querySelectorAll<HTMLElement>('.ms-panel [role=option]'));
  const optionTexts = () => optionEls().map(o => o.textContent!.trim());
  const chips = () => Array.from(el.querySelectorAll('.ms-chip')).map(c => c.textContent!.trim());
  const panel = () => document.querySelector<HTMLElement>('.ms-panel');
  const marked = () => document.querySelector<HTMLElement>('.ms-marked');
  const detect = () => fixture.detectChanges();

  function setup(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(MultiSelectComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('items', LANGS);
    fixture.componentRef.setInput('bindLabel', 'name');
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    detect();
    el = fixture.nativeElement;
  }

  function key(k: string, render = true) {
    const event = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true });
    input().dispatchEvent(event);
    if (render) {
      detect();
    }
    return event;
  }

  function type(text: string) {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    detect();
  }

  function mousedown(target: HTMLElement = control()) {
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    detect();
    return event;
  }

  function open() {
    comp.open();
    detect();
  }

  function clickRow(text: string) {
    rowEls().find(r => r.textContent!.trim() === text)!.click();
    detect();
  }

  describe('rendering', () => {
    it('looks like a Bootstrap form-select with a dropdown-menu', () => {
      setup({ placeholder: 'Pick', size: 'sm' });
      expect(control().classList).toContain('form-select');
      expect(control().classList).toContain('form-select-sm');
      expect(input().placeholder).toBe('Pick');
      fixture.componentRef.setInput('size', 'lg');
      detect();
      expect(control().classList).toContain('form-select-lg');
      open();
      expect(panel()!.classList).toContain('dropdown-menu');
      expect(panel()!.classList).toContain('show');
      expect(optionTexts()).toEqual(['Java', 'Python', 'TypeScript', 'Café']);
      expect(optionEls()[3].classList).toContain('disabled');
    });

    it('resolves labels for primitives, default label key, nested paths and missing values', () => {
      setup();
      fixture.componentRef.setInput('bindLabel', undefined);
      expect(comp.label(null)).toBe('');
      expect(comp.label(5)).toBe('5');
      expect(comp.label({ label: 'L' })).toBe('L');
      expect(comp.label({ other: 1 })).toBe('');
      fixture.componentRef.setInput('bindLabel', 'a.b');
      expect(comp.label({ a: { b: 'nested' } })).toBe('nested');
    });

    it('sets aria attributes and labelForId', () => {
      setup({ labelForId: 'langs' });
      expect(input().id).toBe('langs');
      expect(input().getAttribute('aria-expanded')).toBe('false');
      expect(input().getAttribute('aria-controls')).toBeNull();
      open();
      expect(input().getAttribute('aria-expanded')).toBe('true');
      const listbox = document.querySelector('[role=listbox]')!;
      expect(input().getAttribute('aria-controls')).toBe(listbox.id);
      expect(input().getAttribute('aria-activedescendant')).toBe(optionEls()[0].id);
      expect(listbox.getAttribute('aria-multiselectable')).toBe('true');
    });

    it('generates an input id when labelForId is not set', () => {
      setup();
      expect(input().id).toMatch(/^app-select-\d+-input$/);
    });
  });

  describe('open/close', () => {
    beforeEach(() => setup());

    it('toggles on control mousedown and keeps focus on the input', () => {
      const opened = jasmine.createSpy('open');
      const closed = jasmine.createSpy('close');
      fixture.componentRef.instance.openEvent.subscribe(opened);
      fixture.componentRef.instance.closeEvent.subscribe(closed);
      const event = mousedown();
      expect(event.defaultPrevented).toBeTrue();
      expect(comp.isOpen()).toBeTrue();
      expect(opened).toHaveBeenCalledTimes(1);
      mousedown();
      expect(comp.isOpen()).toBeFalse();
      expect(closed).toHaveBeenCalledTimes(1);
      expect(mousedown(input()).defaultPrevented).toBeFalse();
    });

    it('open/close/toggle are idempotent', () => {
      comp.open();
      comp.open();
      comp.toggle();
      comp.close();
      expect(comp.isOpen()).toBeFalse();
      comp.toggle();
      expect(comp.isOpen()).toBeTrue();
    });

    it('closes and clears the search on blur, marking the control touched', () => {
      const blur = jasmine.createSpy('blur');
      const focus = jasmine.createSpy('focus');
      comp.blurEvent.subscribe(blur);
      comp.focusEvent.subscribe(focus);
      const touched = jasmine.createSpy('touched');
      comp.registerOnTouched(touched);
      input().dispatchEvent(new FocusEvent('focus'));
      detect();
      type('ja');
      expect(comp.isOpen()).toBeTrue();
      input().dispatchEvent(new FocusEvent('blur'));
      detect();
      expect(comp.isOpen()).toBeFalse();
      expect(input().value).toBe('');
      expect(touched).toHaveBeenCalled();
      expect(focus).toHaveBeenCalled();
      expect(blur).toHaveBeenCalled();
    });

    it('handles blur without registered callbacks and null items', () => {
      fixture.componentRef.setInput('items', null);
      open();
      expect(comp.allItems()).toEqual([]);
      input().dispatchEvent(new FocusEvent('blur'));
      expect(comp.isOpen()).toBeFalse();
    });

    it('focus() and blur() delegate to the input', () => {
      const focus = spyOn(input(), 'focus');
      const blur = spyOn(input(), 'blur');
      comp.focus();
      comp.blur();
      expect(focus).toHaveBeenCalled();
      expect(blur).toHaveBeenCalled();
    });

    it('prevents blur when pressing inside the panel', () => {
      open();
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      panel()!.dispatchEvent(event);
      expect(event.defaultPrevented).toBeTrue();
    });
  });

  describe('multiple selection', () => {
    beforeEach(() => setup({ bindValue: 'id' }));

    it('selects and unselects with clicks, emitting outputs and the model value', () => {
      const onChange = jasmine.createSpy('onChange');
      const add = jasmine.createSpy('add');
      const remove = jasmine.createSpy('remove');
      const change = jasmine.createSpy('change');
      comp.registerOnChange(onChange);
      comp.add.subscribe(add);
      comp.remove.subscribe(remove);
      comp.change.subscribe(change);
      open();
      clickRow('Java');
      clickRow('TypeScript');
      expect(onChange).toHaveBeenCalledWith([1, 3]);
      expect(add).toHaveBeenCalledWith(LANGS[0]);
      expect(change).toHaveBeenCalledWith([LANGS[0], LANGS[2]]);
      expect(chips()).toEqual(['Java', 'TypeScript']);
      expect(comp.isOpen()).toBeTrue();
      expect(optionEls()[0].querySelector<HTMLInputElement>('input')!.checked).toBeTrue();
      clickRow('Java');
      expect(remove).toHaveBeenCalledWith(LANGS[0]);
      expect(onChange).toHaveBeenCalledWith([3]);
    });

    it('ignores disabled items and selecting twice', () => {
      comp.select(LANGS[3]);
      comp.select(LANGS[0]);
      comp.select(LANGS[0]);
      expect(comp.selectedValues()).toEqual([1]);
      open();
      clickRow('Café');
      expect(comp.selectedValues()).toEqual([1]);
    });

    it('limits the selection with maxSelectedItems', () => {
      fixture.componentRef.setInput('maxSelectedItems', 1);
      open();
      clickRow('Java');
      expect(optionEls()[1].classList).toContain('disabled');
      clickRow('Python');
      expect(comp.selectedValues()).toEqual([1]);
    });

    it('hides selected items with hideSelected', () => {
      fixture.componentRef.setInput('hideSelected', true);
      open();
      clickRow('Java');
      expect(optionTexts()).toEqual(['Python', 'TypeScript', 'Café']);
    });

    it('closes after select when closeOnSelect is set', () => {
      fixture.componentRef.setInput('closeOnSelect', true);
      open();
      clickRow('Java');
      expect(comp.isOpen()).toBeFalse();
    });

    it('removes chips and clears all', () => {
      const clear = jasmine.createSpy('clear');
      comp.clear.subscribe(clear);
      comp.writeValue([1, 2]);
      detect();
      const chipClose = el.querySelector<HTMLButtonElement>('.ms-chip .btn-close')!;
      expect(chipClose.getAttribute('data-bs-theme')).toBe('dark');
      expect(mousedown(chipClose).defaultPrevented).toBeTrue();
      chipClose.click();
      detect();
      expect(chips()).toEqual(['Python']);
      const clearButton = el.querySelector<HTMLButtonElement>('.ms-clear')!;
      expect(mousedown(clearButton).defaultPrevented).toBeTrue();
      clearButton.click();
      detect();
      expect(chips()).toEqual([]);
      expect(clear).toHaveBeenCalled();
      expect(el.querySelector('.ms-clear')).toBeNull();
    });

    it('clearModel without a value only clears the search', () => {
      const onChange = jasmine.createSpy('onChange');
      comp.registerOnChange(onChange);
      type('ja');
      comp.clearModel();
      expect(onChange).not.toHaveBeenCalled();
      expect(comp.filteredItems().length).toBe(4);
    });

    it('unselect of an unselected item is a no-op', () => {
      const remove = jasmine.createSpy('remove');
      comp.remove.subscribe(remove);
      comp.unselect(LANGS[0]);
      expect(remove).not.toHaveBeenCalled();
    });

    it('uses chip variants for the close button theme', () => {
      fixture.componentRef.setInput('type', 'warning');
      comp.writeValue([1]);
      detect();
      expect(el.querySelector('.ms-chip')!.className).toContain('text-bg-warning');
      expect(el.querySelector('.ms-chip .btn-close')!.getAttribute('data-bs-theme')).toBeNull();
    });
  });

  describe('single selection', () => {
    beforeEach(() => setup({ multiple: false }));

    it('replaces the value, closes and shows the label', () => {
      const onChange = jasmine.createSpy('onChange');
      const change = jasmine.createSpy('change');
      comp.registerOnChange(onChange);
      comp.change.subscribe(change);
      open();
      clickRow('Java');
      expect(comp.isOpen()).toBeFalse();
      expect(onChange).toHaveBeenCalledWith(LANGS[0]);
      expect(change).toHaveBeenCalledWith(LANGS[0]);
      expect(el.querySelector('.ms-single-value')!.textContent!.trim()).toBe('Java');
      expect(input().classList).not.toContain('flex-grow-1');
      open();
      expect(optionEls()[0].classList).toContain('active');
      expect(marked()!.textContent!.trim()).toBe('Java');
      clickRow('Python');
      expect(onChange).toHaveBeenCalledWith(LANGS[1]);
      comp.clearModel();
      expect(onChange).toHaveBeenCalledWith(null);
      expect(change).toHaveBeenCalledWith(null);
    });

    it('hides the label while searching', () => {
      comp.writeValue(LANGS[0]);
      detect();
      type('py');
      expect(el.querySelector('.ms-single-value')).toBeNull();
    });
  });

  describe('search', () => {
    it('filters case and accent insensitively and emits search', () => {
      setup();
      const search = jasmine.createSpy('search');
      comp.search.subscribe(search);
      type('CAFE');
      expect(optionTexts()).toEqual(['Café']);
      expect(search).toHaveBeenCalledWith({ term: 'CAFE', items: [LANGS[3]] });
    });

    it('uses a custom searchFn', () => {
      setup({ searchFn: (term: string, item: Lang) => item.kind.startsWith(term) });
      type('Dyn');
      expect(optionTexts()).toEqual(['Python', 'Café']);
    });

    it('shows the not found text', () => {
      setup({ notFoundText: 'Nothing' });
      type('zzz');
      expect(panel()!.textContent).toContain('Nothing');
    });

    it('clears the search after adding unless clearSearchOnAdd is false', () => {
      setup();
      type('ja');
      clickRow('Java');
      expect(input().value).toBe('');
      fixture.componentRef.setInput('clearSearchOnAdd', false);
      type('py');
      clickRow('Python');
      expect(input().value).toBe('py');
    });

    it('filter() sets the term and opens', () => {
      setup();
      comp.filter('type');
      detect();
      expect(comp.isOpen()).toBeTrue();
      expect(optionTexts()).toEqual(['TypeScript']);
    });
  });

  describe('typeahead', () => {
    let term$: Subject<string>;
    let terms: string[];

    beforeEach(() => {
      term$ = new Subject<string>();
      terms = [];
      term$.subscribe(t => terms.push(t));
      setup({ typeahead: term$, minTermLength: 2, items: [] });
    });

    it('asks to type more until minTermLength is reached', () => {
      open();
      expect(panel()!.textContent).toContain('Type to search');
      type('j');
      expect(terms).toEqual([]);
      type('ja');
      expect(terms).toEqual(['ja']);
      comp.filter('jav');
      expect(terms).toEqual(['ja', 'jav']);
    });

    it('does not filter items locally and shows loading', () => {
      type('xyz');
      fixture.componentRef.setInput('loading', true);
      detect();
      expect(panel()!.textContent).toContain('Loading...');
      expect(el.querySelector('.ms-spinner')).not.toBeNull();
      fixture.componentRef.setInput('items', LANGS);
      fixture.componentRef.setInput('loading', false);
      detect();
      expect(optionTexts().length).toBe(4);
    });

    it('keeps labels of selected items when items change', () => {
      fixture.componentRef.setInput('items', LANGS);
      fixture.componentRef.setInput('bindValue', 'id');
      comp.select(LANGS[0]);
      fixture.componentRef.setInput('items', []);
      detect();
      expect(chips()).toEqual(['Java']);
    });
  });

  describe('keyboard', () => {
    it('navigates, skips disabled rows and selects with Enter', () => {
      setup();
      key('ArrowDown');
      expect(comp.isOpen()).toBeTrue();
      expect(marked()!.textContent!.trim()).toBe('Java');
      key('ArrowDown');
      key('ArrowDown');
      key('ArrowDown');
      expect(marked()!.textContent!.trim()).toBe('TypeScript');
      key('ArrowUp');
      expect(marked()!.textContent!.trim()).toBe('Python');
      expect(key('Enter').defaultPrevented).toBeTrue();
      expect(comp.selectedItems()).toEqual([LANGS[1]]);
    });

    it('ArrowUp does nothing while closed', () => {
      setup();
      expect(key('ArrowUp').defaultPrevented).toBeTrue();
      expect(comp.isOpen()).toBeFalse();
    });

    it('scrolls marked rows into view, tolerating rows not rendered yet', () => {
      setup();
      key('ArrowDown');
      const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
      key('ArrowDown');
      expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
      comp.close();
      detect();
      key('ArrowDown', false);
      key('ArrowDown', false);
      expect(scroll).toHaveBeenCalledTimes(1);
    });

    it('opens with Enter unless openOnEnter is false', () => {
      setup();
      expect(key('Enter').defaultPrevented).toBeTrue();
      expect(comp.isOpen()).toBeTrue();
      comp.close();
      fixture.componentRef.setInput('openOnEnter', false);
      expect(key('Enter').defaultPrevented).toBeFalse();
      expect(comp.isOpen()).toBeFalse();
    });

    it('Enter without a marked row does nothing', () => {
      setup({ markFirst: false });
      open();
      expect(marked()).toBeNull();
      key('Enter');
      expect(comp.selectedItems()).toEqual([]);
    });

    it('uses Space to open and select when not searchable', () => {
      setup({ searchable: false });
      expect(input().readOnly).toBeTrue();
      expect(key(' ').defaultPrevented).toBeTrue();
      expect(comp.isOpen()).toBeTrue();
      key(' ');
      expect(comp.selectedItems()).toEqual([LANGS[0]]);
      fixture.componentRef.setInput('searchable', true);
      expect(key(' ').defaultPrevented).toBeFalse();
    });

    it('Tab selects the marked row with selectOnTab and closes', () => {
      setup({ selectOnTab: true });
      open();
      key('Tab');
      expect(comp.selectedItems()).toEqual([LANGS[0]]);
      expect(comp.isOpen()).toBeFalse();
      fixture.componentRef.setInput('selectOnTab', false);
      open();
      key('Tab');
      expect(comp.selectedItems()).toEqual([LANGS[0]]);
      fixture.componentRef.setInput('selectOnTab', true);
      fixture.componentRef.setInput('markFirst', false);
      open();
      key('Tab');
      expect(comp.isOpen()).toBeFalse();
      key('Tab');
    });

    it('Escape closes without bubbling only when open', () => {
      setup();
      const outer = jasmine.createSpy('outer');
      el.addEventListener('keydown', outer);
      open();
      key('Escape');
      expect(comp.isOpen()).toBeFalse();
      expect(outer).not.toHaveBeenCalled();
      key('Escape');
      expect(outer).toHaveBeenCalledTimes(1);
    });

    it('Backspace removes the last chip or clears a single value', () => {
      setup({ bindValue: 'id' });
      comp.writeValue([1, 2]);
      type('x');
      key('Backspace');
      expect(comp.selectedValues()).toEqual([1, 2]);
      type('');
      key('Backspace');
      expect(comp.selectedValues()).toEqual([1]);
      fixture.componentRef.setInput('clearOnBackspace', false);
      key('Backspace');
      fixture.componentRef.setInput('clearOnBackspace', true);
      fixture.componentRef.setInput('clearable', false);
      key('Backspace');
      expect(comp.selectedValues()).toEqual([1]);
      fixture.componentRef.setInput('clearable', true);
      fixture.componentRef.setInput('multiple', false);
      comp.writeValue(2);
      key('Backspace');
      expect(comp.selectedValues()).toEqual([]);
      key('Backspace');
      key('Home');
    });

    it('respects keyDownFn and ignores keys when disabled', () => {
      setup({ keyDownFn: (e: KeyboardEvent) => e.key !== 'ArrowDown' });
      key('ArrowDown');
      expect(comp.isOpen()).toBeFalse();
      key('Enter');
      expect(comp.isOpen()).toBeTrue();
      comp.close();
      comp.setDisabledState(true);
      key('Enter');
      expect(comp.isOpen()).toBeFalse();
    });

    it('stays on the last row at the end of the list', () => {
      setup({ items: ['a', 'b'] });
      open();
      key('ArrowDown');
      key('ArrowDown');
      expect(marked()!.textContent!.trim()).toBe('b');
      key('ArrowUp');
      key('ArrowUp');
      expect(marked()!.textContent!.trim()).toBe('a');
    });

    it('marks rows on hover except disabled ones', () => {
      setup();
      open();
      optionEls()[2].dispatchEvent(new MouseEvent('mouseenter'));
      detect();
      expect(marked()!.textContent!.trim()).toBe('TypeScript');
      optionEls()[3].dispatchEvent(new MouseEvent('mouseenter'));
      detect();
      expect(marked()!.textContent!.trim()).toBe('TypeScript');
    });

    it('keeps the marked row valid while the list changes', () => {
      setup({ items: ['a', 'b', 'c'] });
      open();
      key('ArrowDown');
      key('ArrowDown');
      fixture.componentRef.setInput('items', ['a']);
      detect();
      expect(marked()!.textContent!.trim()).toBe('a');
      fixture.componentRef.setInput('items', [{ label: 'x', disabled: true }, 'y']);
      fixture.componentRef.setInput('bindLabel', undefined);
      detect();
      expect(marked()!.textContent!.trim()).toBe('y');
      fixture.componentRef.setInput('markFirst', false);
      fixture.componentRef.setInput('items', []);
      detect();
      expect(marked()).toBeNull();
      comp.close();
      fixture.componentRef.setInput('items', ['z']);
      detect();
    });
  });

  describe('groups', () => {
    it('groups by property with Bootstrap dropdown headers', () => {
      setup({ groupBy: 'kind' });
      open();
      const headers = Array.from(document.querySelectorAll('.ms-panel .dropdown-header')).map(h => h.textContent!.trim());
      expect(headers).toEqual(['Static', 'Dynamic']);
      expect(document.querySelector('.ms-panel .dropdown-header')!.getAttribute('role')).toBe('presentation');
      clickRow('Static');
      expect(comp.selectedItems()).toEqual([]);
      expect(optionEls()[0].classList).toContain('ps-4');
    });

    it('groups by function, including object and empty keys', () => {
      const typed = { label: 'Typed' };
      setup({ groupBy: (item: Lang) => (item.kind === 'Static' ? typed : null), bindLabel: 'name' });
      fixture.componentRef.setInput('bindLabel', undefined);
      fixture.componentRef.setInput('items', [{ label: 'a', kind: 'Static' }, { label: 'b', kind: 'Dynamic' }]);
      open();
      const headers = Array.from(document.querySelectorAll('.ms-panel .dropdown-header')).map(h => h.textContent!.trim());
      expect(headers).toEqual(['Typed', '']);
    });

    it('selects and unselects whole groups when selectableGroup is set', () => {
      setup({ groupBy: 'kind', selectableGroup: true, bindValue: 'id' });
      open();
      expect(document.querySelector('.ms-panel .dropdown-header')!.getAttribute('role')).toBe('option');
      clickRow('Static');
      expect(comp.selectedValues()).toEqual([1, 3]);
      expect(document.querySelector<HTMLInputElement>('.ms-group input')!.checked).toBeTrue();
      clickRow('Static');
      expect(comp.selectedValues()).toEqual([]);
      clickRow('Dynamic');
      expect(comp.selectedValues()).toEqual([2]);
      key('ArrowUp');
      key('ArrowUp');
      key('ArrowUp');
      expect(marked()!.textContent!.trim()).toBe('Static');
    });

    it('treats a group with only disabled items as unselected', () => {
      setup({ groupBy: 'kind', selectableGroup: true, items: [LANGS[3]] });
      open();
      expect(document.querySelector<HTMLInputElement>('.ms-group input')!.checked).toBeFalse();
    });

    it('ignores group clicks in single mode', () => {
      setup({ groupBy: 'kind', selectableGroup: true, multiple: false });
      open();
      clickRow('Static');
      expect(comp.selectedItems()).toEqual([]);
    });
  });

  describe('select all', () => {
    it('selects all filtered items and unselects them again', () => {
      setup({ showSelectAll: true, items: ['a', 'b', 'c'] });
      open();
      const selectAll = () => document.querySelector<HTMLElement>('.ms-select-all')!;
      const checkbox = () => selectAll().querySelector<HTMLInputElement>('input')!;
      clickRow('b');
      expect(checkbox().indeterminate).toBeTrue();
      selectAll().click();
      detect();
      expect(comp.selectedValues()).toEqual(['b', 'a', 'c']);
      expect(checkbox().checked).toBeTrue();
      selectAll().click();
      detect();
      expect(comp.selectedValues()).toEqual([]);
      fixture.componentRef.setInput('items', []);
      detect();
      expect(document.querySelector('.ms-select-all')).toBeNull();
    });

    it('does nothing when not interactive', () => {
      setup({ showSelectAll: true, items: ['a'] });
      open();
      fixture.componentRef.setInput('readonly', true);
      document.querySelector<HTMLElement>('.ms-select-all')!.click();
      expect(comp.selectedValues()).toEqual([]);
    });
  });

  describe('addTag', () => {
    it('adds the term as an object with bindLabel', async () => {
      setup({ addTag: true });
      type('Kotlin');
      expect(rowEls()[0].textContent).toContain('Add item');
      expect(rowEls()[0].textContent).toContain('"Kotlin"');
      clickRow(rowEls()[0].textContent!.trim());
      await fixture.whenStable();
      detect();
      expect(comp.selectedItems()).toEqual([{ name: 'Kotlin' }]);
      expect(chips()).toEqual(['Kotlin']);
      type('kotlin');
      expect(document.querySelector('.ms-tag')).toBeNull();
    });

    it('adds a plain string without bindLabel', async () => {
      setup({ addTag: true, items: ['a'], bindLabel: undefined });
      type('b');
      key('Enter');
      await fixture.whenStable();
      expect(comp.selectedItems()).toEqual(['b']);
    });

    it('supports async addTag functions and ignores null results', async () => {
      const addTag = jasmine.createSpy('addTag').and.callFake((term: string) =>
        Promise.resolve(term === 'skip' ? null : { id: 99, name: term }));
      setup({ addTag });
      type('skip');
      key('Enter');
      await fixture.whenStable();
      expect(comp.selectedItems()).toEqual([]);
      type('New');
      key('Enter');
      await fixture.whenStable();
      expect(comp.selectedItems()).toEqual([{ id: 99, name: 'New' }]);
      expect(addTag).toHaveBeenCalledTimes(2);
    });

    it('hides the add row while loading or without a term', () => {
      setup({ addTag: true, loading: true });
      type('x');
      expect(document.querySelector('.ms-tag')).toBeNull();
      fixture.componentRef.setInput('loading', false);
      type('  ');
      expect(document.querySelector('.ms-tag')).toBeNull();
    });

    it('shows the add row even when typeahead needs more characters', () => {
      setup({ addTag: true, typeahead: new Subject<string>(), minTermLength: 3 });
      type('ab');
      expect(document.querySelector('.ms-tag')).not.toBeNull();
      expect(panel()!.textContent).not.toContain('Type to search');
    });
  });

  describe('virtual scroll', () => {
    const many = Array.from({ length: 100 }, (_, i) => `Item ${i}`);

    async function setupVirtual() {
      setup({ virtualScroll: true, items: many, itemSize: 30 });
      open();
      for (let i = 0; i < 3; i++) {
        await fixture.whenStable();
        detect();
      }
      return fixture.debugElement.query(By.directive(CdkVirtualScrollViewport))
        .injector.get(CdkVirtualScrollViewport);
    }

    it('renders a CDK viewport with a subset of rows', async () => {
      const viewport = await setupVirtual();
      expect(viewport.getViewportSize()).toBe(240);
      expect(optionEls().length).toBeLessThan(100);
      expect(optionEls()[0].style.height).toBe('30px');
    });

    it('scrolls to the selected row when opening', async () => {
      setup({ virtualScroll: true, items: many, itemSize: 30, multiple: false });
      comp.writeValue('Item 50');
      const viewport = () => fixture.debugElement.query(By.directive(CdkVirtualScrollViewport))
        .injector.get(CdkVirtualScrollViewport);
      open();
      for (let i = 0; i < 3; i++) {
        await fixture.whenStable();
        detect();
      }
      expect(viewport().measureScrollOffset()).toBe(50 * 30);
      // The CDK re-renders the visible range on the next animation frame after scrolling.
      await new Promise(resolve => requestAnimationFrame(resolve));
      await fixture.whenStable();
      detect();
      expect(optionTexts()).toContain('Item 50');
    });

    it('does not scroll on open without a marked row', async () => {
      setup({ items: many, markFirst: false });
      const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
      open();
      await fixture.whenStable();
      expect(scroll).not.toHaveBeenCalled();
      comp.close();
      fixture.componentRef.setInput('markFirst', true);
      open();
      await fixture.whenStable();
      expect(scroll).toHaveBeenCalled();
    });

    it('scrolls to keep the marked row visible', async () => {
      const viewport = await setupVirtual();
      const scrollTo = spyOn(viewport, 'scrollToOffset').and.callThrough();
      for (let i = 0; i < 8; i++) {
        key('ArrowDown');
      }
      expect(scrollTo).toHaveBeenCalledWith(30);
      for (let i = 0; i < 8; i++) {
        key('ArrowUp');
      }
      expect(scrollTo).toHaveBeenCalledWith(0);
    });

    it('emits scroll and scrollToEnd', async () => {
      const viewport = await setupVirtual();
      const scroll = jasmine.createSpy('scroll');
      const end = jasmine.createSpy('end');
      comp.scroll.subscribe(scroll);
      comp.scrollToEnd.subscribe(end);
      const host = viewport.elementRef.nativeElement;
      host.scrollTop = 300;
      host.dispatchEvent(new Event('scroll'));
      expect(scroll).toHaveBeenCalledWith({ start: 10, end: 18 });
      expect(end).not.toHaveBeenCalled();
      host.scrollTop = 100 * 30;
      host.dispatchEvent(new Event('scroll'));
      expect(end).toHaveBeenCalled();
    });
  });

  it('emits scrollToEnd for the regular list', () => {
    setup({ items: Array.from({ length: 50 }, (_, i) => i) });
    const end = jasmine.createSpy('end');
    const scroll = jasmine.createSpy('scroll');
    comp.scrollToEnd.subscribe(end);
    comp.scroll.subscribe(scroll);
    open();
    const list = document.querySelector<HTMLElement>('.ms-options')!;
    list.scrollTop = 10;
    list.dispatchEvent(new Event('scroll'));
    expect(end).not.toHaveBeenCalled();
    list.scrollTop = list.scrollHeight;
    list.dispatchEvent(new Event('scroll'));
    expect(end).toHaveBeenCalled();
    expect(scroll).not.toHaveBeenCalled();
  });

  describe('dropdown position', () => {
    const rect = (top: number, bottom: number) =>
      ({ top, bottom, width: 200, height: bottom - top, left: 0, right: 200, x: 0, y: top } as DOMRect);

    it('opens above in auto mode when there is no room below', () => {
      setup();
      spyOn(control(), 'getBoundingClientRect').and.returnValue(rect(window.innerHeight - 20, window.innerHeight));
      open();
      expect(panel()!.classList).toContain('bottom-100');
      expect(panel()!.classList).not.toContain('top-100');
    });

    it('opens below in auto mode with room below', () => {
      setup();
      spyOn(control(), 'getBoundingClientRect').and.returnValue(rect(0, 30));
      open();
      expect(panel()!.classList).toContain('top-100');
    });

    it('honours explicit top/bottom positions', () => {
      setup({ dropdownPosition: 'top' });
      open();
      expect(panel()!.classList).toContain('bottom-100');
      comp.close();
      fixture.componentRef.setInput('dropdownPosition', 'bottom');
      open();
      expect(panel()!.classList).toContain('top-100');
    });

    it('renders in a CDK overlay when appended to body', () => {
      setup({ appendTo: 'body' });
      open();
      expect(el.querySelector('.ms-panel')).toBeNull();
      expect(panel()!.closest('.cdk-overlay-container')).not.toBeNull();
      expect(panel()!.classList).toContain('position-static');
      // Global styles stack the overlay above Bootstrap modals (1055) like a popover (1070), below toasts (1090).
      expect(getComputedStyle(panel()!.closest('.cdk-overlay-container')!).zIndex).toBe('1070');
      clickRow('Java');
      expect(comp.selectedItems()).toEqual([LANGS[0]]);
      comp.close();
      detect();
      expect(panel()).toBeNull();
      for (const position of ['top', 'bottom'] as const) {
        fixture.componentRef.setInput('dropdownPosition', position);
        open();
        expect(panel()).not.toBeNull();
        comp.close();
        detect();
      }
    });
  });

  describe('ControlValueAccessor', () => {
    it('normalizes written values', () => {
      setup({ bindValue: 'id' });
      comp.writeValue('nope');
      expect(comp.selectedValues()).toEqual([]);
      comp.writeValue([2]);
      detect();
      expect(chips()).toEqual(['Python']);
      fixture.componentRef.setInput('multiple', false);
      comp.writeValue(null);
      expect(comp.selectedValues()).toEqual([]);
      comp.writeValue(3);
      expect(comp.selectedItems()).toEqual([LANGS[2]]);
    });

    it('resolves labels once items arrive and falls back to the raw value', () => {
      setup({ bindValue: 'id', items: [] });
      comp.writeValue([1, 42]);
      detect();
      expect(chips()).toEqual(['1', '42']);
      fixture.componentRef.setInput('items', LANGS);
      fixture.componentRef.setInput('bindLabel', 'name');
      detect();
      expect(chips()).toEqual(['Java', '42']);
    });

    it('uses compareWith for object values', () => {
      setup({ compareWith: (a: Lang, b: Lang) => a.id === b.id });
      comp.writeValue([{ id: 2, name: 'copy', kind: '' }]);
      detect();
      expect(chips()).toEqual(['Python']);
      expect(comp.isSelected(LANGS[1])).toBeTrue();
    });

    it('disables and re-enables through setDisabledState', () => {
      setup();
      open();
      comp.setDisabledState(true);
      detect();
      expect(comp.isOpen()).toBeFalse();
      expect(input().disabled).toBeTrue();
      expect(control().classList).toContain('bg-body-secondary');
      mousedown();
      expect(comp.isOpen()).toBeFalse();
      comp.select(LANGS[0]);
      comp.unselect(LANGS[0]);
      comp.clearModel();
      expect(comp.selectedItems()).toEqual([]);
      comp.setDisabledState(false);
      detect();
      expect(input().disabled).toBeFalse();
    });

    it('readonly prevents changes', () => {
      setup({ readonly: true });
      comp.writeValue([LANGS[0]]);
      detect();
      expect(input().readOnly).toBeTrue();
      expect(el.querySelector('.ms-chip .btn-close')).toBeNull();
      comp.open();
      expect(comp.isOpen()).toBeFalse();
    });

    @Component({
      imports: [MultiSelectComponent, ReactiveFormsModule],
      template: `<app-multi-select [items]="items" bindLabel="name" bindValue="id" [formControl]="ctrl" />`
    })
    class ReactiveHost {
      items = LANGS;
      ctrl = new FormControl<number[]>([2]);
    }

    @Component({
      imports: [MultiSelectComponent, FormsModule],
      template: `<app-multi-select [items]="items" [multiple]="false" [(ngModel)]="model" />`
    })
    class TemplateHost {
      items = ['a', 'b', 'c'];
      model = signal<string | null>('b');
    }

    it('works with reactive forms', () => {
      const f = TestBed.createComponent(ReactiveHost);
      f.detectChanges();
      const host: HTMLElement = f.nativeElement;
      expect(host.querySelector('.ms-chip')!.textContent).toContain('Python');
      const select = f.debugElement.query(By.directive(MultiSelectComponent)).componentInstance as MultiSelectComponent;
      select.select(LANGS[0]);
      expect(f.componentInstance.ctrl.value).toEqual([2, 1]);
      host.querySelector('input')!.dispatchEvent(new FocusEvent('blur'));
      f.detectChanges();
      expect(f.componentInstance.ctrl.touched).toBeTrue();
      expect(host.querySelector('app-multi-select')!.classList).toContain('ng-touched');
      f.componentInstance.ctrl.setValue([]);
      f.componentInstance.ctrl.disable();
      f.detectChanges();
      expect(host.querySelector('input')!.disabled).toBeTrue();
    });

    it('shows Bootstrap .is-invalid once the control is invalid and touched', () => {
      const f = TestBed.createComponent(ReactiveHost);
      f.componentInstance.ctrl.setValidators(c => (c.value?.length ? null : { required: true }));
      f.componentInstance.ctrl.setValue([]);
      f.detectChanges();
      const control = () => (f.nativeElement as HTMLElement).querySelector('.ms-control')!;
      expect(control().classList).not.toContain('is-invalid');
      f.componentInstance.ctrl.markAsTouched();
      f.detectChanges();
      expect(control().classList).toContain('is-invalid');
    });

    it('works with template-driven forms (ngModel)', async () => {
      const f = TestBed.createComponent(TemplateHost);
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();
      const host: HTMLElement = f.nativeElement;
      expect(host.querySelector('.ms-single-value')!.textContent!.trim()).toBe('b');
      const select = f.debugElement.query(By.directive(MultiSelectComponent)).componentInstance as MultiSelectComponent;
      select.select('c');
      expect(f.componentInstance.model()).toBe('c');
    });
  });

  describe('templates', () => {
    @Component({
      imports: [MultiSelectComponent, ...SELECT_TEMPLATES],
      template: `
        <app-multi-select [items]="items()" bindLabel="name" groupBy="kind" [multiple]="multiple()"
                          [addTag]="true" [loading]="loading()" [typeahead]="typeahead()" [minTermLength]="2">
          <ng-template appSelectOption let-item let-search="searchTerm" let-i="index">
            <i class="opt">{{ i }}:{{ item.name }}:{{ search }}</i>
          </ng-template>
          <ng-template appSelectLabel let-item let-clear="clear">
            <b class="lbl" (click)="clear()">{{ item.name }}</b>
          </ng-template>
          <ng-template appSelectOptgroup let-label="label" let-items="items">
            <u class="grp">{{ label }} ({{ items.length }})</u>
          </ng-template>
          <ng-template appSelectHeader let-term><div class="hdr">H:{{ term }}</div></ng-template>
          <ng-template appSelectFooter let-term><div class="ftr">F:{{ term }}</div></ng-template>
          <ng-template appSelectNotFound let-term><div class="nf">none for {{ term }}</div></ng-template>
          <ng-template appSelectLoading><div class="ld">wait</div></ng-template>
          <ng-template appSelectTypeToSearch><div class="tts">more</div></ng-template>
          <ng-template appSelectTag let-term><div class="tag">new {{ term }}</div></ng-template>
        </app-multi-select>`
    })
    class TemplatesHost {
      items = signal(LANGS);
      multiple = signal(true);
      loading = signal(false);
      typeahead = signal<Subject<string> | undefined>(undefined);
    }

    @Component({
      imports: [MultiSelectComponent, SelectMultiLabelTemplate],
      template: `
        <app-multi-select [items]="items">
          <ng-template appSelectMultiLabel let-items let-clear="clear">
            <span class="multi">{{ items.length }} selected</span>
            <button class="clr" (click)="clear(items[0])">x</button>
          </ng-template>
        </app-multi-select>`
    })
    class MultiLabelHost {
      items = ['a', 'b'];
    }

    let hostFixture: ComponentFixture<TemplatesHost>;
    let select: MultiSelectComponent;
    const q = (s: string) => document.querySelector<HTMLElement>(s);

    beforeEach(() => {
      hostFixture = TestBed.createComponent(TemplatesHost);
      hostFixture.detectChanges();
      select = hostFixture.debugElement.query(By.directive(MultiSelectComponent)).componentInstance;
    });

    function refresh() {
      hostFixture.detectChanges();
    }

    it('renders option, group, header, footer and label templates', () => {
      select.open();
      refresh();
      expect(q('.opt')!.textContent).toBe('1:Java:');
      expect(q('.grp')!.textContent).toBe('Static (2)');
      expect(q('.hdr')!.textContent).toBe('H:');
      expect(q('.ftr')!.textContent).toBe('F:');
      select.select(LANGS[0]);
      refresh();
      expect(q('.ms-chip .lbl')!.textContent).toBe('Java');
      q('.ms-chip .lbl')!.click();
      refresh();
      expect(select.selectedItems()).toEqual([]);
      hostFixture.componentInstance.multiple.set(false);
      refresh();
      select.select(LANGS[1]);
      refresh();
      expect(q('.ms-single-value .lbl')!.textContent).toBe('Python');
    });

    it('renders not found, tag, loading and type-to-search templates', () => {
      select.filter('zz');
      refresh();
      expect(q('.tag')!.textContent).toBe('new zz');
      expect(q('.ms-tag')).not.toBeNull();
      hostFixture.componentInstance.items.set([]);
      select.filter('Java');
      refresh();
      expect(q('.nf')).toBeNull();
      hostFixture.componentInstance.loading.set(true);
      select.filter('');
      refresh();
      expect(q('.ld')!.textContent).toBe('wait');
      hostFixture.componentInstance.loading.set(false);
      hostFixture.componentInstance.typeahead.set(new Subject<string>());
      refresh();
      expect(q('.tts')!.textContent).toBe('more');
    });

    it('renders the not found template', () => {
      const f = TestBed.createComponent(TemplatesHost);
      f.componentInstance.items.set([]);
      f.detectChanges();
      const s = f.debugElement.query(By.directive(MultiSelectComponent)).componentInstance as MultiSelectComponent;
      s.open();
      f.detectChanges();
      expect(q('.nf')!.textContent).toBe('none for ');
    });

    it('renders the multi label template', () => {
      const f = TestBed.createComponent(MultiLabelHost);
      f.detectChanges();
      const s = f.debugElement.query(By.directive(MultiSelectComponent)).componentInstance as MultiSelectComponent;
      s.writeValue(['a', 'b']);
      f.detectChanges();
      expect(q('.multi')!.textContent).toBe('2 selected');
      expect(document.querySelector('.ms-chip')).toBeNull();
      q('.clr')!.click();
      expect(s.selectedValues()).toEqual(['b']);
    });

    it('declares typed template contexts', () => {
      const guards = [
        SelectOptionTemplate, SelectLabelTemplate, SelectMultiLabelTemplate, SelectOptgroupTemplate,
        SelectHeaderTemplate, SelectFooterTemplate, SelectNotFoundTemplate, SelectLoadingTemplate,
        SelectTypeToSearchTemplate, SelectTagTemplate
      ];
      for (const dir of guards) {
        expect((dir as any).ngTemplateContextGuard(null, {})).toBeTrue();
      }
    });
  });
});
