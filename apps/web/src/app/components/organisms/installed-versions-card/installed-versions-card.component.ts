import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { InstalledNodeVersion } from '../../../models/nvm.models';

@Component({
  selector: 'app-installed-versions-card',
  standalone: true,
  imports: [CardComponent, LoadingStateComponent],
  templateUrl: './installed-versions-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstalledVersionsCardComponent {
  readonly versions = input<InstalledNodeVersion[]>([]);
  readonly raw = input('');
  readonly loading = input(false);
  readonly isLoading = input(false);

  readonly useVersion = output<string>();
  readonly uninstallVersion = output<string>();
  readonly refresh = output<void>();
}
