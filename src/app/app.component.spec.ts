import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ToastService } from './shared/toast';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let app: AppComponent;
  let toast: ToastService;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 0, 1));
    fixture = TestBed.createComponent(AppComponent);
    app = fixture.componentInstance;
    toast = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('renders all demos', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')!.textContent).toContain('Bootstrap Components');
    expect(el.querySelectorAll('app-tag-input').length).toBe(7);
    expect(el.querySelectorAll('app-multi-select').length).toBe(7);
  });

  it('shows toasts with the playground options and reacts to taps', () => {
    const info = spyOn(toast, 'info').and.callThrough();
    app.showToast('success');
    expect(toast.toasts()[0].title).toBe('Heads up');
    expect(toast.toasts()[0].config.progressBar).toBeTrue();
    toast.toasts()[0].toastRef.tap();
    expect(info).toHaveBeenCalledWith('Toast tapped', undefined, { positionClass: 'toast-top-right' });

    app['title'].set('');
    app.showToast('error');
    expect(toast.toasts().at(-1)!.title).toBeUndefined();
  });

  it('updates global toast options', () => {
    app.setGlobal('preventDuplicates', true);
    app.setMaxOpened(3);
    expect(toast.config.preventDuplicates).toBeTrue();
    expect(toast.config.maxOpened).toBe(3);
    toast.config.preventDuplicates = false;
    toast.config.maxOpened = 0;
  });

  it('validates the reactive form on submit', () => {
    const error = spyOn(toast, 'error').and.callThrough();
    const success = spyOn(toast, 'success').and.callThrough();
    app.submit();
    expect(error).toHaveBeenCalled();
    app['form'].controls.favourite.setValue(1);
    app.submit();
    expect(success).toHaveBeenCalledWith(jasmine.stringContaining('"favourite":1'), 'Submitted');
  });

  it('toggles the disabled state of the form', () => {
    app.toggleDisabled();
    expect(app['form'].disabled).toBeTrue();
    app.toggleDisabled();
    expect(app['form'].enabled).toBeTrue();
  });

  it('creates custom tags', () => {
    expect(app['addCustomTag']('Kotlin')).toEqual(jasmine.objectContaining({ name: 'Kotlin', kind: 'Custom' }));
  });

  it('provides tag input helpers', () => {
    expect(app['lowerCase']('MiXeD')).toBe('mixed');
    const obj = { value: 'X' };
    expect(app['lowerCase'](obj)).toBe(obj);
    let found: unknown;
    app['searchPeople']('grace').subscribe(r => (found = r));
    jasmine.clock().tick(300);
    expect(found).toEqual(['Grace Hopper']);
  });

  it('searches people asynchronously', () => {
    app['peopleInput$'].next('ada');
    jasmine.clock().tick(200);
    expect(app['peopleLoading']()).toBeTrue();
    jasmine.clock().tick(400);
    expect(app['peopleLoading']()).toBeFalse();
    expect(app['people']()).toEqual(['Ada Lovelace']);
  });
});
