import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormField, disabled, form, minLength } from '@angular/forms/signals';
import { MultiSelectComponent } from '../multi-select/multi-select.component';
import { TagInputComponent } from '../tag-input/tag-input.component';
import { TagModel } from '../tag-input/tag-input.types';

/** Signal Forms (`[formField]`) work through Angular's NgControl interop; no component-specific API needed. */
describe('Signal Forms integration', () => {
  @Component({
    imports: [TagInputComponent, MultiSelectComponent, FormField],
    template: ` <app-tag-input [formField]="profile.tags" />
      <app-multi-select [items]="languages" [formField]="profile.languages" />`,
  })
  class Host {
    languages = ['Java', 'Python'];
    locked = signal(false);
    model = signal({ tags: ['a'] as TagModel[], languages: [] as string[] });
    profile = form(this.model, (p) => {
      minLength(p.languages, 1);
      disabled(p.tags, () => this.locked());
    });
  }

  async function create() {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    const tagInput = f.debugElement.query(By.directive(TagInputComponent))
      .componentInstance as TagInputComponent;
    const select = f.debugElement.query(By.directive(MultiSelectComponent))
      .componentInstance as MultiSelectComponent;
    return { f, el, tagInput, select };
  }

  it('syncs values both ways', async () => {
    const { f, el, tagInput, select } = await create();
    expect(el.querySelectorAll('.ti-chip').length).toBe(1);
    expect(await tagInput.add('b')).toBe(true);
    select.select('Python');
    expect(f.componentInstance.model()).toEqual({
      tags: ['a', 'b'],
      languages: ['Python'],
    });
    f.componentInstance.model.set({
      tags: ['x', 'y', 'z'],
      languages: ['Java'],
    });
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(el.querySelectorAll('.ti-chip').length).toBe(3);
    expect(el.querySelector('.ms-chip')!.textContent).toContain('Java');
  });

  it('shows .is-invalid once the field is touched, and touches on blur', async () => {
    const { f, el } = await create();
    const control = () => el.querySelector('app-multi-select .ms-control')!;
    expect(control().classList).not.toContain('is-invalid');
    el.querySelector<HTMLInputElement>('app-multi-select input')!.dispatchEvent(
      new FocusEvent('blur'),
    );
    f.detectChanges();
    expect(f.componentInstance.profile.languages().touched()).toBe(true);
    expect(control().classList).toContain('is-invalid');
  });

  it('follows the disabled rule', async () => {
    const { f, el } = await create();
    expect(el.querySelector('app-tag-input input')).not.toBeNull();
    f.componentInstance.locked.set(true);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(el.querySelector('app-tag-input input')).toBeNull();
  });
});
