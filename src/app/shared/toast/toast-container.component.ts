import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

/** Place once in the root template: <app-toast-container /> */
@Component({
  selector: 'app-toast-container',
  templateUrl: './toast-container.component.html',
  styleUrls: ['./toast-container.component.scss']
})
export class ToastContainerComponent {
  readonly service = inject(ToastService);
}
