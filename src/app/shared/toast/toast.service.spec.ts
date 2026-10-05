import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    service = TestBed.inject(ToastService);
  });

  it('adds typed toasts', () => {
    service.success('ok', { title: 'Done', timeOut: 0 });
    service.error('bad', { timeOut: 0 });
    expect(service.toasts().map(t => t.type)).toEqual(['success', 'danger']);
    expect(service.toasts()[0].title).toBe('Done');
  });

  it('auto-dismisses after timeOut', fakeAsync(() => {
    service.info('hi', { timeOut: 1000 });
    expect(service.toasts().length).toBe(1);
    tick(1000);
    expect(service.toasts().length).toBe(0);
  }));

  it('keeps toasts with timeOut 0 until removed', fakeAsync(() => {
    const id = service.warning('sticky', { timeOut: 0 });
    tick(60000);
    expect(service.toasts().length).toBe(1);
    service.remove(id);
    expect(service.toasts().length).toBe(0);
  }));

  it('clear removes everything', () => {
    service.info('a', { timeOut: 0 });
    service.info('b', { timeOut: 0 });
    service.clear();
    expect(service.toasts()).toEqual([]);
  });
});
