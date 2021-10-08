import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from "@angular/forms";
import { TagInputComponent } from './tag-input/tag-input.component';


@NgModule({
  declarations: [
    TagInputComponent
  ],
  exports: [
    TagInputComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class SharedModule {
}
