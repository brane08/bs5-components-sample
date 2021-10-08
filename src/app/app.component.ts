import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'bs5-components-sample';
  tagList = ["initial", "values", "here"];
  typeList = ["primary", "success", "info", "warning", "danger"];
  selectedType = this.typeList[0]
}
