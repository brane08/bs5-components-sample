import { Component, inject } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ToastService } from './shared/toast/toast.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    standalone: false
})
export class AppComponent {
  title = 'bs5-components-sample';
  tagList = ["initial", "values", "here"];
  typeList = ["primary", "success", "info", "warning", "danger"];
  selectedType = this.typeList[0];
  languages = ['Python', 'Java', 'TypeScript', 'SQL', 'Go', 'Rust'];
  selectedLanguages = ['Python', 'TypeScript'];
  toast = inject(ToastService);
  form = inject(FormBuilder).nonNullable.group({
    tags: [['reactive']],
    languages: [['Java']]
  });

  submit() {
    this.toast.success('Submitted: ' + JSON.stringify(this.form.getRawValue()));
  }
}
