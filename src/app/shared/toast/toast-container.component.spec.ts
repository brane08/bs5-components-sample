import { TestBed } from '@angular/core/testing';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService } from './toast.service';

describe('ToastContainerComponent', () => {
  it('renders toasts and closes them', () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    const service = TestBed.inject(ToastService);
    service.success('Saved', { title: 'Great', timeOut: 0 });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.toast')?.textContent).toContain('Saved');
    expect(el.querySelector('.toast')?.classList).toContain('text-bg-success');
    (el.querySelector('.btn-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('.toast').length).toBe(0);
  });
});
