import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { SharedModule } from "./shared/shared.module";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { ToastContainerComponent } from "./shared/toast/toast-container.component";
import { MultiSelectComponent } from "./shared/multi-select/multi-select.component";

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    ToastContainerComponent,
    MultiSelectComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
