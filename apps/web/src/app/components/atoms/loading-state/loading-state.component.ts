import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SpinnerComponent } from '../spinner/spinner.component';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [SpinnerComponent],
  template: `
    <div class="loading-state">
      <app-spinner />
      <span>{{ message() }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingStateComponent {
  readonly message = input.required<string>();
}
