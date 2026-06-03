import { Component, Input, inject } from '@angular/core';
import type { InstalledNodeVersion } from '../../../models/nvm.models';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-app-header',
  standalone: true,
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
})
export class AppHeaderComponent {
  @Input() activeVersion: InstalledNodeVersion | undefined = undefined;

  readonly themeService = inject(ThemeService);
}
