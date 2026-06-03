import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { InstalledNodeVersion } from '../../../models/nvm.models';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-app-header',
  standalone: true,
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  readonly activeVersion = input<InstalledNodeVersion | undefined>(undefined);

  readonly themeService = inject(ThemeService);
}
