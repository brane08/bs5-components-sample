// Initializes the Angular testing environment (zoneless, matching the app).
import { NgModule, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

@NgModule({ providers: [provideZonelessChangeDetection()] })
class ZonelessTestingModule {}

getTestBed().initTestEnvironment(
  [BrowserTestingModule, ZonelessTestingModule],
  platformBrowserTesting(),
  { teardown: { destroyAfterEach: true } },
);
