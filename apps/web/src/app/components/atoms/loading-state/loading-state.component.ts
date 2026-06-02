import { Component, Input } from '@angular/core';
import { SpinnerComponent } from '../spinner/spinner.component';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [SpinnerComponent],
  template: `
    <div class="loading-state">
      <app-spinner />
      <span>{{ message }}</span>
    </div>
  `,
})
export class LoadingStateComponent {
  @Input({ required: true }) message!: string;
}
