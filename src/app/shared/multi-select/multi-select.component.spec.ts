import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MultiSelectComponent } from './multi-select.component';

@Component({
  imports: [MultiSelectComponent, ReactiveFormsModule],
  template: `<app-multi-select [items]="items" bindLabel="name" bindValue="id" [maxSelected]="max()"
                               [formControl]="ctrl"></app-multi-select>`
})
class HostComponent {
  items = [{ id: 1, name: 'Java' }, { id: 2, name: 'Python' }, { id: 3, name: 'TypeScript' }];
  max = signal(0);
  ctrl = new FormControl<number[]>([2]);
}

describe('MultiSelectComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;

  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('li[role=option]'));
  const openPanel = () => {
    el.querySelector<HTMLInputElement>('.ms-input')!.focus();
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('shows the written value as chips', () => {
    expect(el.querySelectorAll('.badge').length).toBe(1);
    expect(el.querySelector('.badge')?.textContent).toContain('Python');
  });

  it('toggles items and updates the form control with bindValue', () => {
    openPanel();
    rows()[0].click();
    expect(host.ctrl.value).toEqual([2, 1]);
    rows()[1].click();
    expect(host.ctrl.value).toEqual([1]);
  });

  it('filters by search text', () => {
    openPanel();
    const input = el.querySelector<HTMLInputElement>('.ms-input')!;
    input.value = 'type';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(rows().map(r => r.textContent?.trim())).toEqual(['TypeScript']);
  });

  it('supports keyboard selection and Backspace removal', () => {
    openPanel();
    const input = el.querySelector<HTMLInputElement>('.ms-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(host.ctrl.value).toEqual([2, 1]);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    expect(host.ctrl.value).toEqual([2]);
  });

  it('respects maxSelected and clear', () => {
    host.max.set(1);
    fixture.detectChanges();
    openPanel();
    rows()[0].click();
    expect(host.ctrl.value).toEqual([2]);
    el.querySelector<HTMLButtonElement>('button[aria-label="Clear all"]')!.click();
    expect(host.ctrl.value).toEqual([]);
  });

  it('disables via the form control', () => {
    host.ctrl.disable();
    fixture.detectChanges();
    expect(el.querySelector('.ms-control')?.classList).toContain('disabled');
  });

  it('works with template-driven forms (ngModel)', async () => {
    @Component({
      imports: [MultiSelectComponent, FormsModule],
      template: `<app-multi-select [items]="items" [(ngModel)]="model"></app-multi-select>`
    })
    class TemplateHost {
      items = ['a', 'b', 'c'];
      model = ['b'];
    }
    const f = TestBed.createComponent(TemplateHost);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelectorAll('.badge').length).toBe(1);
    f.nativeElement.querySelector('.ms-input').focus();
    f.detectChanges();
    f.nativeElement.querySelectorAll('li[role=option]')[0].click();
    expect(f.componentInstance.model).toEqual(['b', 'a']);
  });
});
