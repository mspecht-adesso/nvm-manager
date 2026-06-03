import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  template: `<span class="spinner"></span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpinnerComponent {}
