import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, Subject, of, throwError } from 'rxjs';
import { TagDragService } from './tag-drag.service';
import { provideTagInputConfig } from './tag-input.config';
import { TagInputComponent } from './tag-input.component';
import { TagModel } from './tag-input.types';
import { TagDropdownItemTemplate, TagTemplate } from './tag-templates';

describe('TagInputComponent', () => {
  let fixture: ComponentFixture<TagInputComponent>;
  let comp: TagInputComponent;
  let el: HTMLElement;

  const detect = () => fixture.detectChanges();
  const input = () => el.querySelector<HTMLInputElement>('input.ti-input')!;
  const control = () => el.querySelector<HTMLElement>('.ti-control')!;
  const chips = () => Array.from(el.querySelectorAll<HTMLElement>('.ti-chip'));
  const chipTexts = () => chips().map(c => c.textContent!.trim());
  const options = () => Array.from(el.querySelectorAll<HTMLElement>('.dropdown-item[role=option]'));
  const optionTexts = () => options().map(o => o.textContent!.trim());
  const errors = () => Array.from(el.querySelectorAll('.invalid-feedback')).map(e => e.textContent!.trim());

  /** Lets async add/remove/validation chains and afterNextRender hooks finish. */
  async function settle() {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
    detect();
    await fixture.whenStable();
    detect();
  }

  function setup(inputs: Record<string, unknown> = {}) {
    fixture = TestBed.createComponent(TagInputComponent);
    comp = fixture.componentInstance;
    fixture.componentRef.setInput('tags', ['a', 'b']);
    for (const [k, v] of Object.entries(inputs)) {
      fixture.componentRef.setInput(k, v);
    }
    detect();
    el = fixture.nativeElement;
  }

  function type(text: string) {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    detect();
  }

  function key(k: string, target: HTMLElement = input(), init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true, ...init });
    target.dispatchEvent(event);
    detect();
    return event;
  }

  async function enter(text: string) {
    type(text);
    key('Enter');
    await settle();
  }

  describe('rendering', () => {
    it('renders Bootstrap badges inside a form-control', () => {
      setup();
      expect(control().classList).toContain('form-control');
      expect(chipTexts()).toEqual(['a', 'b']);
      expect(chips()[0].className).toContain('text-bg-secondary');
      expect(chips()[0].classList).toContain('focus-ring');
      expect(el.querySelector('.btn-close')!.getAttribute('data-bs-theme')).toBe('dark');
      fixture.componentRef.setInput('type', 'warning');
      detect();
      expect(el.querySelector('.btn-close')!.getAttribute('data-bs-theme')).toBeNull();
    });

    it('sets input id, class and tabindex', () => {
      setup({ inputId: 'tags', inputClass: 'extra', tabindex: '3' });
      expect(input().id).toBe('tags');
      expect(input().classList).toContain('extra');
      expect(input().classList).toContain('ti-input');
      expect(input().getAttribute('tabindex')).toBe('3');
      fixture.componentRef.setInput('tabindex', '');
      detect();
      expect(input().hasAttribute('tabindex')).toBeFalse();
      fixture.componentRef.setInput('inputId', undefined);
      detect();
      expect(input().id).toMatch(/^app-tag-input-\d+-input$/);
    });

    it('chooses between placeholder and secondaryPlaceholder', () => {
      setup({ placeholder: '+ Tag' });
      expect(input().placeholder).toBe('');
      fixture.componentRef.setInput('tags', []);
      detect();
      expect(input().placeholder).toBe('+ Tag');
      fixture.componentRef.setInput('secondaryPlaceholder', 'Add tags');
      detect();
      expect(input().placeholder).toBe('Add tags');
      fixture.componentRef.setInput('tags', ['x']);
      detect();
      expect(input().placeholder).toBe('+ Tag');
    });

    it('renders read-only when editor is false', async () => {
      setup({ editor: false });
      expect(el.querySelector('input')).toBeNull();
      expect(el.querySelector('.btn-close')).toBeNull();
      expect(control().classList).toContain('form-control-plaintext');
      control().click();
      expect(await comp.remove(0)).toBeFalse();
      expect(await comp.add('x')).toBeFalse();
    });

    it('hides only the input with hideForm', async () => {
      setup({ hideForm: true });
      expect(el.querySelector('input')).toBeNull();
      expect(el.querySelector('.btn-close')).not.toBeNull();
      expect(await comp.add('c')).toBeTrue();
    });

    it('disables via the disabled input', () => {
      setup({ disabled: true });
      expect(el.querySelector('input')).toBeNull();
      expect(control().classList).toContain('bg-body-secondary');
    });

    it('focuses the input when the control is clicked', () => {
      setup();
      const focus = spyOn(input(), 'focus');
      control().click();
      expect(focus).toHaveBeenCalled();
      chips()[0].click();
      expect(focus).toHaveBeenCalledTimes(1);
    });
  });

  describe('adding', () => {
    it('clears the input as soon as a tag is added, before the next render', async () => {
      setup();
      type('c');
      key(',', input(), {});
      input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }
      expect(input().value).toBe('');
      expect(comp.tags()).toEqual(['a', 'b', 'c']);
    });

    it('adds a trimmed tag on Enter and emits', async () => {
      setup();
      const added = jasmine.createSpy('add');
      const tags: TagModel[][] = [];
      comp.added.subscribe(added);
      comp.tags.subscribe(t => tags.push(t));
      type('  c ');
      expect(key('Enter').defaultPrevented).toBeTrue();
      await settle();
      expect(comp.tags()).toEqual(['a', 'b', 'c']);
      expect(tags).toEqual([['a', 'b', 'c']]);
      expect(added).toHaveBeenCalledWith('c');
      expect(input().value).toBe('');
    });

    it('keeps whitespace when trimTags is false', async () => {
      setup({ trimTags: false });
      await enter(' c ');
      expect(comp.tags()).toEqual(['a', 'b', ' c ']);
    });

    it('ignores blank values and blinks duplicates', async () => {
      jasmine.clock().install();
      try {
        setup();
        await enter('   ');
        await enter('a');
        expect(comp.tags()).toEqual(['a', 'b']);
        expect(chips()[0].classList).toContain('opacity-50');
        jasmine.clock().tick(300);
        detect();
        expect(chips()[0].classList).not.toContain('opacity-50');
        fixture.componentRef.setInput('blinkIfDupe', false);
        await enter('a');
        expect(chips()[0].classList).not.toContain('opacity-50');
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('allows duplicates with allowDupes', async () => {
      setup({ allowDupes: true });
      await enter('a');
      expect(comp.tags()).toEqual(['a', 'b', 'a']);
    });

    it('splits on separatorKeys, separatorKeyCodes and Space when allow-space is false', async () => {
      setup({ separatorKeys: [','], separatorKeyCodes: [186] });
      type('c');
      expect(key(',').defaultPrevented).toBeTrue();
      await settle();
      type('d');
      key(';', input(), { keyCode: 186 });
      await settle();
      type('e');
      expect(key(' ').defaultPrevented).toBeFalse();
      fixture.componentRef.setInput('allow-space', false);
      key(' ');
      await settle();
      expect(comp.tags()).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('stops at maxItems and hides the input', async () => {
      setup({ maxItems: 3 });
      await enter('c');
      expect(el.querySelector('input.ti-input')).toBeNull();
      expect(await comp.add('d')).toBeFalse();
    });

    it('creates object tags when modelAsStrings is false', async () => {
      setup({ tags: [], modelAsStrings: false });
      await enter('x');
      expect(comp.tags()).toEqual([{ value: 'x', display: 'x' }]);
      expect(chipTexts()).toEqual(['x']);
    });

    it('stores autocomplete objects as strings when modelAsStrings is true', async () => {
      setup({ tags: [], identifyBy: 'id' });
      await comp.add({ id: 'java', name: 'Java' }, true);
      expect(comp.tags()).toEqual(['java']);
    });

    it('labels object tags by displayBy, then identifyBy', () => {
      setup({ tags: [{ value: 1, display: 'One' }, { value: 2 }, {}] });
      expect(chipTexts()).toEqual(['One', '2', '']);
      expect(comp.identify('s')).toBe('s');
    });
  });

  describe('hooks', () => {
    it('transforms or cancels with onAdding', async () => {
      setup({ onAdding: (t: TagModel) => (t as string).toUpperCase() });
      await enter('c');
      fixture.componentRef.setInput('onAdding', (t: TagModel) => of(`${t}!`));
      await enter('d');
      fixture.componentRef.setInput('onAdding', () => Promise.reject(new Error('no')));
      await enter('e');
      fixture.componentRef.setInput('onAdding', () => EMPTY);
      await enter('f');
      expect(comp.tags()).toEqual(['a', 'b', 'C', 'd!']);
      expect(input().value).toBe('f');
    });

    it('confirms or cancels removal with onRemoving', async () => {
      setup({ onRemoving: () => throwError(() => new Error('keep')) });
      expect(await comp.remove(0)).toBeFalse();
      fixture.componentRef.setInput('onRemoving', (t: TagModel) => Promise.resolve(t));
      const removed = jasmine.createSpy('remove');
      comp.removed.subscribe(removed);
      expect(await comp.remove(0)).toBeTrue();
      expect(removed).toHaveBeenCalledWith('a');
      expect(await comp.remove(5)).toBeFalse();
    });

    it('does not remove when removable is false', async () => {
      setup({ removable: false });
      expect(el.querySelector('.btn-close')).toBeNull();
      expect(await comp.remove(0)).toBeFalse();
    });
  });

  describe('validation', () => {
    it('shows Bootstrap feedback for failing validators', async () => {
      setup({
        validators: [Validators.minLength(3), Validators.pattern(/^[a-z]+$/)],
        errorMessages: { minlength: 'Too short' }
      });
      const failed = jasmine.createSpy('validationError');
      comp.validationError.subscribe(failed);
      await enter('X1');
      expect(comp.tags()).toEqual(['a', 'b']);
      expect(errors()).toEqual(['Too short']);
      expect(control().classList).toContain('is-invalid');
      expect(failed).toHaveBeenCalledWith('X1');
      type('X12');
      expect(errors()).toEqual([]);
      await enter('abc');
      expect(comp.tags()).toEqual(['a', 'b', 'abc']);
    });

    it('runs async validators', async () => {
      setup({
        asyncValidators: [(c: { value: string }) => of(c.value === 'taken' ? { taken: true } : null)],
        errorMessages: { taken: 'Already taken' }
      });
      await enter('taken');
      expect(errors()).toEqual(['Already taken']);
      await enter('free');
      expect(comp.tags()).toEqual(['a', 'b', 'free']);
    });
  });

  describe('blur & paste', () => {
    it('adds on blur by default, emitting blur and marking touched', async () => {
      setup();
      const blur = jasmine.createSpy('blur');
      const focus = jasmine.createSpy('focus');
      comp.blurred.subscribe(blur);
      comp.focused.subscribe(focus);
      input().dispatchEvent(new FocusEvent('focus'));
      expect(focus).toHaveBeenCalledWith('');
      type('z');
      input().dispatchEvent(new FocusEvent('blur'));
      await settle();
      expect(comp.tags()).toEqual(['a', 'b', 'z']);
      expect(blur).toHaveBeenCalledWith('z');
    });

    it('clears or keeps the text on blur when addOnBlur is false', () => {
      setup({ addOnBlur: false });
      type('z');
      input().dispatchEvent(new FocusEvent('blur'));
      expect(comp.inputText()).toBe('z');
      fixture.componentRef.setInput('clearOnBlur', true);
      input().dispatchEvent(new FocusEvent('blur'));
      expect(comp.inputText()).toBe('');
    });

    function paste(text?: string) {
      const data = new DataTransfer();
      if (text !== undefined) {
        data.setData('text', text);
      }
      const event = new ClipboardEvent('paste', { clipboardData: text === undefined ? null : data, cancelable: true });
      input().dispatchEvent(event);
      return event;
    }

    it('emits paste and only splits into tags with addOnPaste', async () => {
      setup();
      const pasted = jasmine.createSpy('paste');
      comp.pasted.subscribe(pasted);
      expect(paste('x,y').defaultPrevented).toBeFalse();
      expect(pasted).toHaveBeenCalledWith('x,y');
      fixture.componentRef.setInput('addOnPaste', true);
      expect(paste('x, y,,a').defaultPrevented).toBeTrue();
      await settle();
      expect(comp.tags()).toEqual(['a', 'b', 'x', 'y']);
      fixture.componentRef.setInput('pasteSplitPattern', /[;|]/);
      paste('p;q|r');
      await settle();
      expect(comp.tags()).toEqual(['a', 'b', 'x', 'y', 'p', 'q', 'r']);
      paste();
      expect(pasted).toHaveBeenCalledWith('');
    });
  });

  describe('keyboard', () => {
    beforeEach(() => setup({ tags: ['a', 'b', 'c'] }));

    const focusedChip = () => chips().indexOf(document.activeElement as HTMLElement);

    it('moves from the input to the last chip with Backspace or ArrowLeft at the start', async () => {
      const select = jasmine.createSpy('select');
      comp.selected.subscribe(select);
      document.body.appendChild(el);
      type('x');
      input().setSelectionRange(1, 1);
      key('Backspace');
      await settle();
      expect(focusedChip()).toBe(-1);
      type('');
      expect(key('ArrowLeft').defaultPrevented).toBeTrue();
      await settle();
      expect(focusedChip()).toBe(2);
      expect(select).toHaveBeenCalledWith('c');
      key('Tab');
    });

    it('navigates between chips and back to the input', async () => {
      document.body.appendChild(el);
      chips()[1].focus();
      key('ArrowLeft', chips()[1]);
      await settle();
      expect(focusedChip()).toBe(0);
      key('ArrowLeft', chips()[0]);
      await settle();
      expect(focusedChip()).toBe(0);
      key('ArrowRight', chips()[0]);
      await settle();
      expect(focusedChip()).toBe(1);
      key('ArrowRight', chips()[2]);
      await settle();
      expect(document.activeElement).toBe(input());
      chips()[0].focus();
      key('Escape', chips()[0]);
      expect(document.activeElement).toBe(input());
      key('x', chips()[0]);
    });

    it('removes the focused chip with Backspace/Delete and moves focus', async () => {
      document.body.appendChild(el);
      key('Backspace', chips()[1]);
      await settle();
      expect(comp.tags()).toEqual(['a', 'c']);
      expect(focusedChip()).toBe(0);
      key('Delete', chips()[0]);
      await settle();
      expect(comp.tags()).toEqual(['c']);
      expect(focusedChip()).toBe(0);
      key('Delete', chips()[0]);
      await settle();
      expect(comp.tags()).toEqual([]);
      expect(document.activeElement).toBe(input());
    });

    it('keeps chips when removal is not allowed', async () => {
      fixture.componentRef.setInput('removable', false);
      key('Backspace', chips()[1]);
      await settle();
      expect(comp.tags()).toEqual(['a', 'b', 'c']);
    });

    it('does nothing at the start without tags', () => {
      fixture.componentRef.setInput('tags', []);
      detect();
      expect(key('Backspace').defaultPrevented).toBeFalse();
    });
  });

  describe('editing', () => {
    const editInput = () => el.querySelector<HTMLInputElement>('.ti-chip input')!;

    async function edit(index: number, text: string, commitKey = 'Enter') {
      chips()[index].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      editInput().value = text;
      if (commitKey === 'blur') {
        editInput().dispatchEvent(new FocusEvent('blur'));
      } else {
        key(commitKey, editInput());
      }
      await settle();
    }

    it('ignores double-click unless editable', async () => {
      setup();
      chips()[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      expect(el.querySelector('.ti-chip input')).toBeNull();
    });

    it('edits a tag in place with Enter or blur', async () => {
      setup({ editable: true, tags: ['a', 'b', 'c'] });
      document.body.appendChild(el);
      const edited = jasmine.createSpy('tagEdited');
      comp.tagEdited.subscribe(edited);
      chips()[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      expect(document.activeElement).toBe(editInput());
      editInput().click();
      editInput().value = 'aa';
      key('x', editInput());
      key('Enter', editInput());
      await settle();
      expect(comp.tags()).toEqual(['aa', 'b', 'c']);
      expect(edited).toHaveBeenCalledWith('aa');
      await edit(1, ' bb ', 'blur');
      expect(comp.tags()).toEqual(['aa', 'bb', 'c']);
    });

    it('keeps the tag when unchanged, duplicate or invalid; removes it when emptied', async () => {
      setup({ editable: true, tags: ['a', 'b', 'c'], validators: [Validators.maxLength(3)] });
      await edit(0, 'a');
      await edit(0, 'b');
      await edit(0, 'long');
      expect(comp.tags()).toEqual(['a', 'b', 'c']);
      fixture.componentRef.setInput('allowDupes', true);
      await edit(0, 'b');
      expect(comp.tags()).toEqual(['b', 'b', 'c']);
      await edit(2, '  ');
      expect(comp.tags()).toEqual(['b', 'b']);
    });

    it('keeps whitespace when trimTags is false', async () => {
      setup({ editable: true, trimTags: false });
      await edit(0, ' a ');
      expect(comp.tags()).toEqual([' a ', 'b']);
    });

    it('edits object tags and keeps other properties', async () => {
      setup({ editable: true, tags: [{ value: 'x', display: 'x', extra: 1 }] });
      await edit(0, 'y');
      expect(comp.tags()).toEqual([{ value: 'y', display: 'y', extra: 1 }]);
    });

    it('cancels with Escape', async () => {
      setup({ editable: true });
      document.body.appendChild(el);
      await edit(0, 'zz', 'Escape');
      expect(comp.tags()).toEqual(['a', 'b']);
      expect(document.activeElement).toBe(chips()[0]);
    });

    it('tolerates the edit being cancelled before it renders', async () => {
      setup({ editable: true });
      chips()[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      comp['editingIndex'].set(-1);
      await settle();
      expect(el.querySelector('.ti-chip input')).toBeNull();
    });
  });

  describe('autocomplete', () => {
    const LANGS = [{ id: 1, name: 'Java' }, { id: 2, name: 'JavaScript' }, { id: 3, name: 'Python' }];

    it('suggests matching items not yet added and adds them on click', async () => {
      setup({ tags: [], autocompleteItems: ['Java', 'JavaScript', 'Python'] });
      expect(input().getAttribute('role')).toBe('combobox');
      type('ja');
      expect(optionTexts()).toEqual(['Java', 'JavaScript']);
      expect(input().getAttribute('aria-expanded')).toBe('true');
      options()[1].click();
      await settle();
      expect(comp.tags()).toEqual(['JavaScript']);
      type('ja');
      expect(optionTexts()).toEqual(['Java']);
    });

    it('navigates suggestions with the keyboard', async () => {
      setup({ tags: [], autocompleteItems: ['a1', 'a2', 'a3'] });
      type('a');
      expect(input().getAttribute('aria-activedescendant')).toBeNull();
      key('ArrowDown');
      key('ArrowDown');
      key('ArrowDown');
      key('ArrowDown');
      expect(input().getAttribute('aria-activedescendant')).toBe(options()[2].id);
      expect(options()[2].classList).toContain('bg-body-tertiary');
      key('ArrowUp');
      key('Enter');
      await settle();
      expect(comp.tags()).toEqual(['a2']);
      expect(options().length).toBe(0);
      type('a');
      options()[0].dispatchEvent(new MouseEvent('mouseenter'));
      detect();
      expect(options()[0].classList).toContain('bg-body-tertiary');
      key('Escape');
      expect(options().length).toBe(0);
      type('a');
      expect(options().length).toBe(2);
    });

    it('adds the typed text with Enter when no suggestion is active', async () => {
      setup({ tags: [], autocompleteItems: ['alpha'] });
      await enter('al');
      expect(comp.tags()).toEqual(['al']);
    });

    it('blocks free text with onlyFromAutocomplete', async () => {
      setup({ tags: [], autocompleteItems: ['alpha'], onlyFromAutocomplete: true, focusFirstElement: true });
      type('al');
      expect(options()[0].classList).toContain('bg-body-tertiary');
      key('Enter');
      await settle();
      expect(comp.tags()).toEqual(['alpha']);
      await enter('zz');
      expect(comp.tags()).toEqual(['alpha']);
    });

    it('closes after picking unless keepOpen', async () => {
      setup({ tags: [], autocompleteItems: ['a1', 'a2'], keepOpen: false, minimumTextLength: 0 });
      type('a');
      options()[0].click();
      await settle();
      expect(options().length).toBe(0);
    });

    it('uses matchingFn, limitItemsTo, displayBy and the item template', async () => {
      @Component({
        imports: [TagInputComponent, TagDropdownItemTemplate],
        template: `
          <app-tag-input [autocompleteItems]="langs" identifyBy="id" displayBy="name" [modelAsStrings]="false"
                         [matchingFn]="startsWith" [limitItemsTo]="1">
            <ng-template appTagDropdownItem let-item let-display="display" let-i="index">
              <b>{{ i }}-{{ display }}</b>
            </ng-template>
          </app-tag-input>`
      })
      class Host {
        langs = LANGS;
        startsWith = (text: string, item: TagModel) => (item as { name: string }).name.startsWith(text);
      }
      const f = TestBed.createComponent(Host);
      f.detectChanges();
      fixture = f as unknown as ComponentFixture<TagInputComponent>;
      el = f.nativeElement;
      comp = f.debugElement.query(By.directive(TagInputComponent)).componentInstance;
      type('Ja');
      expect(optionTexts()).toEqual(['0-Java']);
      options()[0].click();
      await settle();
      expect(comp.tags()).toEqual([LANGS[0]]);
    });

    it('shows all items on focus with showDropdownIfEmpty', () => {
      setup({ tags: [], autocompleteItems: ['x', 'y'], showDropdownIfEmpty: true });
      input().dispatchEvent(new FocusEvent('focus'));
      detect();
      expect(optionTexts()).toEqual(['x', 'y']);
    });

    it('hides the dropdown when the input is hidden', async () => {
      setup({ tags: [], autocompleteItems: ['x', 'y'], maxItems: 1 });
      type('x');
      options()[0].click();
      await settle();
      expect(el.querySelector('.dropdown-menu')).toBeNull();
    });

    describe('remote', () => {
      let results: Subject<TagModel[]>;
      let search: jasmine.Spy;

      beforeEach(() => {
        jasmine.clock().install();
        results = new Subject<TagModel[]>();
        search = jasmine.createSpy('search').and.callFake(() => results);
      });

      afterEach(() => jasmine.clock().uninstall());

      it('debounces text changes, shows loading and the results', () => {
        setup({ tags: [], autocompleteObservable: search, textChangeDebounce: 100 });
        const textChange = jasmine.createSpy('textChange');
        comp.textChange.subscribe(textChange);
        type('p');
        type('py');
        jasmine.clock().tick(100);
        detect();
        expect(search).toHaveBeenCalledOnceWith('py');
        expect(textChange).toHaveBeenCalledOnceWith('py');
        expect(el.querySelector('.spinner-border')).not.toBeNull();
        key('ArrowDown');
        results.next(['Python', 'PyPy']);
        detect();
        expect(optionTexts()).toEqual(['Python', 'PyPy']);
      });

      it('cancels the previous request and recovers from errors', () => {
        setup({ tags: [], autocompleteObservable: search, textChangeDebounce: 0 });
        type('a');
        jasmine.clock().tick(0);
        const first = results;
        results = new Subject<TagModel[]>();
        type('ab');
        jasmine.clock().tick(0);
        expect(first.observed).toBeFalse();
        results.error(new Error('down'));
        detect();
        expect(el.querySelector('.spinner-border')).toBeNull();
        expect(options().length).toBe(0);
      });

      it('does not search below minimumTextLength unless showing on empty focus', () => {
        setup({ tags: [], autocompleteObservable: search, minimumTextLength: 2, textChangeDebounce: 0 });
        type('a');
        jasmine.clock().tick(0);
        expect(search).not.toHaveBeenCalled();
        fixture.componentRef.setInput('showDropdownIfEmpty', true);
        type('');
        input().dispatchEvent(new FocusEvent('focus'));
        expect(search).toHaveBeenCalledWith('');
      });

      it('cleans up the timer and request on destroy', () => {
        setup({ tags: [], autocompleteObservable: search, textChangeDebounce: 0 });
        type('a');
        jasmine.clock().tick(0);
        type('ab');
        fixture.destroy();
        jasmine.clock().tick(0);
        expect(search).toHaveBeenCalledTimes(1);
        expect(results.observed).toBeFalse();
      });
    });
  });

  describe('templates', () => {
    @Component({
      imports: [TagInputComponent, TagTemplate],
      template: `
        <app-tag-input [tags]="tags">
          <ng-template appTag let-display="display" let-remove="remove" let-removable="removable" let-i="index">
            <i class="custom" (click)="remove()">{{ i }}:{{ display }}:{{ removable }}</i>
          </ng-template>
        </app-tag-input>`
    })
    class Host {
      tags = ['a', 'b'];
    }

    it('renders the custom tag template with a remove callback', async () => {
      const f = TestBed.createComponent(Host);
      f.detectChanges();
      const host: HTMLElement = f.nativeElement;
      expect(Array.from(host.querySelectorAll('.custom')).map(c => c.textContent)).toEqual(['0:a:true', '1:b:true']);
      host.querySelector<HTMLElement>('.custom')!.click();
      await Promise.resolve();
      const tagInput = f.debugElement.query(By.directive(TagInputComponent)).componentInstance as TagInputComponent;
      await settleFixture(f);
      expect(tagInput.tags()).toEqual(['b']);
    });

    it('declares typed template contexts', () => {
      expect(TagTemplate.ngTemplateContextGuard(null!, {})).toBeTrue();
      expect(TagDropdownItemTemplate.ngTemplateContextGuard(null!, {})).toBeTrue();
    });
  });

  describe('drag & drop', () => {
    @Component({
      imports: [TagInputComponent],
      template: `
        <app-tag-input id="a" dragZone="z" [(tags)]="a" />
        <app-tag-input id="b" dragZone="z" [(tags)]="b" [maxItems]="max()" />
        <app-tag-input id="c" dragZone="other" [(tags)]="c" />
        <app-tag-input id="d" [(tags)]="d" />`
    })
    class Host {
      a = signal<TagModel[]>(['a1', 'a2', 'a3']);
      b = signal<TagModel[]>(['b1']);
      c = signal<TagModel[]>(['c1']);
      d = signal<TagModel[]>(['d1']);
      max = signal(0);
    }

    let f: ComponentFixture<Host>;
    const zone = (id: string) => (f.nativeElement as HTMLElement).querySelector<HTMLElement>(`#${id}`)!;
    const chipsOf = (id: string) => Array.from(zone(id).querySelectorAll<HTMLElement>('.ti-chip'));
    const fire = (type: string, target: HTMLElement, withData = true) => {
      const event = new DragEvent(type, {
        bubbles: true, cancelable: true, dataTransfer: withData ? new DataTransfer() : null
      });
      target.dispatchEvent(event);
      f.detectChanges();
      return event;
    };
    const dragTo = (from: HTMLElement, to: HTMLElement) => {
      fire('dragstart', from);
      const over = fire('dragover', to);
      fire('drop', to);
      fire('dragend', from);
      return over;
    };

    beforeEach(() => {
      f = TestBed.createComponent(Host);
      f.detectChanges();
    });

    it('makes chips draggable only inside a drag zone', () => {
      expect(chipsOf('a')[0].getAttribute('draggable')).toBe('true');
      expect(chipsOf('d')[0].hasAttribute('draggable')).toBeFalse();
      expect(fire('dragstart', chipsOf('d')[0]).defaultPrevented).toBeTrue();
    });

    it('moves a tag into another input of the same zone', () => {
      const event = fire('dragstart', chipsOf('a')[0]);
      expect(event.dataTransfer!.getData('text/plain')).toBe('a1');
      expect(chipsOf('a')[0].classList).toContain('opacity-50');
      expect(fire('dragover', zone('b').querySelector('.ti-control')!).defaultPrevented).toBeTrue();
      fire('drop', chipsOf('b')[0]);
      fire('dragend', chipsOf('a')[0]);
      expect(f.componentInstance.a()).toEqual(['a2', 'a3']);
      expect(f.componentInstance.b()).toEqual(['a1', 'b1']);
      expect(TestBed.inject(TagDragService).current).toBeNull();
      dragTo(chipsOf('a')[0], zone('b').querySelector('.ti-control')!);
      expect(f.componentInstance.b()).toEqual(['a1', 'b1', 'a2']);
    });

    it('reorders tags within one input', () => {
      dragTo(chipsOf('a')[0], chipsOf('a')[2]);
      expect(f.componentInstance.a()).toEqual(['a2', 'a1', 'a3']);
      dragTo(chipsOf('a')[2], chipsOf('a')[0]);
      expect(f.componentInstance.a()).toEqual(['a3', 'a2', 'a1']);
    });

    it('rejects drops from other zones, when full, or duplicates', () => {
      expect(dragTo(chipsOf('c')[0], zone('a').querySelector('.ti-control')!).defaultPrevented).toBeFalse();
      expect(f.componentInstance.a()).toEqual(['a1', 'a2', 'a3']);
      f.componentInstance.b.set(['a1']);
      f.detectChanges();
      dragTo(chipsOf('a')[0], zone('b').querySelector('.ti-control')!);
      expect(f.componentInstance.b()).toEqual(['a1']);
      f.componentInstance.max.set(1);
      f.detectChanges();
      dragTo(chipsOf('a')[1], zone('b').querySelector('.ti-control')!);
      expect(f.componentInstance.a()).toEqual(['a1', 'a2', 'a3']);
      fire('drop', zone('a').querySelector('.ti-control')!);
    });

    it('works without dataTransfer', () => {
      fire('dragstart', chipsOf('a')[0], false);
      expect(TestBed.inject(TagDragService).current!.item).toBe('a1');
    });
  });

  describe('forms', () => {
    @Component({
      imports: [TagInputComponent, ReactiveFormsModule],
      template: `<app-tag-input [formControl]="ctrl" />`
    })
    class ReactiveHost {
      ctrl = new FormControl<TagModel[] | null>(['x']);
    }

    @Component({
      imports: [TagInputComponent, FormsModule],
      template: `<app-tag-input [(ngModel)]="model" />`
    })
    class TemplateHost {
      model = signal<TagModel[]>(['p']);
    }

    it('works with reactive forms (value, touched, disabled)', async () => {
      const f = TestBed.createComponent(ReactiveHost);
      f.detectChanges();
      const host: HTMLElement = f.nativeElement;
      const field = host.querySelector('input')!;
      field.value = 'y';
      field.dispatchEvent(new Event('input'));
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await settleFixture(f);
      expect(f.componentInstance.ctrl.value).toEqual(['x', 'y']);
      field.dispatchEvent(new FocusEvent('blur'));
      expect(f.componentInstance.ctrl.touched).toBeTrue();
      const tagInput = f.debugElement.children[0].componentInstance as TagInputComponent;
      const emitted = jasmine.createSpy('tagsChange');
      tagInput.tags.subscribe(emitted);
      f.componentInstance.ctrl.setValue(null);
      f.detectChanges();
      expect(emitted).not.toHaveBeenCalled();
      expect(host.querySelectorAll('.ti-chip').length).toBe(0);
      f.componentInstance.ctrl.disable();
      f.detectChanges();
      expect(host.querySelector('input')).toBeNull();
      f.componentInstance.ctrl.enable();
      f.detectChanges();
      expect(host.querySelector('input')).not.toBeNull();
    });

    it('shows Bootstrap .is-invalid once the control is invalid and touched', () => {
      const f = TestBed.createComponent(ReactiveHost);
      f.componentInstance.ctrl.setValidators(c => (c.value?.length ? null : { required: true }));
      f.componentInstance.ctrl.setValue([]);
      f.detectChanges();
      const ctrl = () => (f.nativeElement as HTMLElement).querySelector('.ti-control')!;
      expect(ctrl().classList).not.toContain('is-invalid');
      f.componentInstance.ctrl.markAsTouched();
      f.detectChanges();
      expect(ctrl().classList).toContain('is-invalid');
    });

    it('works with template-driven forms (ngModel)', async () => {
      const f = TestBed.createComponent(TemplateHost);
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();
      const host: HTMLElement = f.nativeElement;
      expect(host.querySelector('.ti-chip')!.textContent).toContain('p');
      host.querySelector<HTMLButtonElement>('.btn-close')!.click();
      await settleFixture(f);
      expect(f.componentInstance.model()).toEqual([]);
    });
  });

  describe('reliability, announcements and config', () => {
    it('rejects a duplicate while the first add is still validating', async () => {
      let release!: (v: null) => void;
      setup({ tags: [], asyncValidators: [() => new Promise(r => (release = r))] });
      type('x');
      key('Enter');
      key('Enter');
      release(null);
      await settle();
      expect(comp.tags()).toEqual(['x']);
    });

    it('emits nothing when destroyed while an add, removal or edit is pending', async () => {
      const releases: ((v: null) => void)[] = [];
      let confirm!: (t: TagModel) => void;
      setup({ editable: true, asyncValidators: [() => new Promise(r => releases.push(r))],
        onRemoving: (t: TagModel) => new Promise(r => (confirm = () => r(t))) });
      const emitted = jasmine.createSpy('emitted');
      comp.tags.subscribe(emitted);
      const warn = spyOn(console, 'warn');
      const adding = comp.add('c');
      const removing = comp.remove(0);
      chips()[1].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      const edit = el.querySelector<HTMLInputElement>('.ti-chip input')!;
      edit.value = 'bb';
      key('Enter', edit);
      fixture.destroy();
      releases.forEach(release => release(null));
      confirm('a');
      expect(await adding).toBeFalse();
      expect(await removing).toBeFalse();
      await settle();
      expect(emitted).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it('removes the right tag when the list changes while onRemoving runs', async () => {
      let confirm!: (t: TagModel) => void;
      setup({ tags: ['a', 'b', 'c'], onRemoving: (t: TagModel) => new Promise(r => (confirm = () => r(t))) });
      const removing = comp.remove(1);
      fixture.componentRef.setInput('tags', ['z', 'a', 'b', 'c']);
      detect();
      confirm('b');
      expect(await removing).toBeTrue();
      expect(comp.tags()).toEqual(['z', 'a', 'c']);
    });

    it('does nothing when the tag disappeared while onRemoving ran', async () => {
      let confirm!: (t: TagModel) => void;
      setup({ tags: ['a', 'b'], onRemoving: (t: TagModel) => new Promise(r => (confirm = () => r(t))) });
      const removing = comp.remove(1);
      fixture.componentRef.setInput('tags', ['a']);
      detect();
      confirm('b');
      expect(await removing).toBeFalse();
      expect(comp.tags()).toEqual(['a']);
    });

    it('announces added and removed tags in a live region', async () => {
      setup();
      const live = () => el.querySelector('[aria-live=polite]')!.textContent!.trim();
      expect(el.querySelector('[aria-live=polite]')!.classList).toContain('visually-hidden');
      await enter('c');
      expect(live()).toBe('c added');
      await comp.remove(0);
      detect();
      expect(live()).toBe('a removed');
    });

    it('uses configurable labels', async () => {
      setup({ removeTagText: 'Entfernen {label}', editTagText: 'Bearbeiten {label}', editable: true,
        loadingText: 'Laden', autocompleteObservable: () => new Subject<TagModel[]>(), textChangeDebounce: 0 });
      expect(el.querySelector('.btn-close')!.getAttribute('aria-label')).toBe('Entfernen a');
      chips()[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      expect(el.querySelector('.ti-chip input')!.getAttribute('aria-label')).toBe('Bearbeiten a');
    });

    it('takes defaults from provideTagInputConfig', async () => {
      TestBed.configureTestingModule({
        providers: [provideTagInputConfig({ type: 'info', secondaryPlaceholder: 'Tags...', separatorKeys: [';'] })]
      });
      setup({ tags: [] });
      expect(input().placeholder).toBe('Tags...');
      type('q');
      expect(key(';').defaultPrevented).toBeTrue();
      await settle();
      expect(comp.tags()).toEqual(['q']);
    });

    it('shows the configured loading text', () => {
      setup({ tags: [], loadingText: 'Laden', autocompleteObservable: () => new Subject<TagModel[]>(),
        textChangeDebounce: 0 });
      jasmine.clock().install();
      try {
        type('a');
        jasmine.clock().tick(0);
        detect();
        expect(el.querySelector('.dropdown-menu')!.textContent).toContain('Laden');
      } finally {
        jasmine.clock().uninstall();
      }
    });
  });
});

async function settleFixture(f: ComponentFixture<unknown>) {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
  f.detectChanges();
  await f.whenStable();
}
