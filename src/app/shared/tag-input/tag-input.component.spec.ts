import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { TagInputComponent } from './tag-input.component';

describe('TagInputComponent', () => {
  let component: TagInputComponent;
  let fixture: ComponentFixture<TagInputComponent>;
  let emitted: string[][];

  const key = (k: string) => component.onKeydown(new KeyboardEvent('keydown', { key: k }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TagInputComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TagInputComponent);
    component = fixture.componentInstance;
    component.tags = ['a', 'b'];
    emitted = [];
    component.tagsChange.subscribe(t => emitted.push(t));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('adds a trimmed tag on Enter without mutating the input array', () => {
    const original = component.tags;
    component.txtModel = '  c ';
    key('Enter');
    expect(emitted).toEqual([['a', 'b', 'c']]);
    expect(original).toEqual(['a', 'b']);
    expect(component.txtModel).toBe('');
  });

  it('ignores blank and duplicate values', () => {
    component.txtModel = '   ';
    key('Enter');
    component.txtModel = 'a';
    key('Enter');
    expect(emitted).toEqual([]);
  });

  it('only splits on space when allow-space is false', () => {
    component.txtModel = 'x';
    key(' ');
    expect(emitted).toEqual([]);
    component.allowSpace = false;
    key(' ');
    expect(emitted).toEqual([['a', 'b', 'x']]);
  });

  it('removes the last tag on Backspace with empty input only', () => {
    component.txtModel = 'x';
    key('Backspace');
    expect(emitted).toEqual([]);
    component.txtModel = '';
    key('Backspace');
    expect(emitted).toEqual([['a']]);
  });

  it('removes the clicked tag', () => {
    fixture.nativeElement.querySelectorAll('button')[0].click();
    expect(emitted).toEqual([['b']]);
  });

  it('commits pending text on blur', () => {
    component.txtModel = 'z';
    component.commit();
    expect(emitted).toEqual([['a', 'b', 'z']]);
  });

  it('works with reactive forms', async () => {
    @Component({
      imports: [TagInputComponent, ReactiveFormsModule],
      template: `<app-tag-input [formControl]="ctrl"></app-tag-input>`
    })
    class ReactiveHost {
      ctrl = new FormControl<string[]>(['x']);
    }
    const f = TestBed.createComponent(ReactiveHost);
    f.detectChanges();
    await f.whenStable();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelectorAll('.badge').length).toBe(1);
    const input = el.querySelector('input')!;
    input.value = 'y';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(f.componentInstance.ctrl.value).toEqual(['x', 'y']);
    f.componentInstance.ctrl.setValue(['z']);
    f.detectChanges();
    await f.whenStable();
    expect(el.querySelector('.badge')?.textContent).toContain('z');
    f.componentInstance.ctrl.disable();
    f.detectChanges();
    await f.whenStable();
    expect(el.querySelector('input')).toBeNull();
  });

  it('works with template-driven forms (ngModel)', async () => {
    @Component({
      imports: [TagInputComponent, FormsModule],
      template: `<app-tag-input [(ngModel)]="model"></app-tag-input>`
    })
    class TemplateHost {
      model = ['p'];
    }
    const f = TestBed.createComponent(TemplateHost);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('.badge')?.textContent).toContain('p');
    el.querySelector<HTMLButtonElement>('button')!.click();
    expect(f.componentInstance.model).toEqual([]);
  });
});
