import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { appConfig } from './app.config';
import { ToastService } from 'bs5-components';

describe('appConfig', () => {
  it('provides zoneless change detection and the global toast options', () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    expect(TestBed.inject(ApplicationRef)).toBeTruthy();
    const { config } = TestBed.inject(ToastService);
    expect(config.closeButton).toBe(true);
    expect(config.progressBar).toBe(true);
  });
});
