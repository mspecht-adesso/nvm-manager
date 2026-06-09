import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import type { InstalledNodeVersion } from '../../../models/nvm.models';
import { ThemeService } from '../../../services/theme.service';

/**
 * Application header (organism) showing the app title, the currently active
 * Node.js version, and the light/dark theme toggle.
 *
 * The theme toggle is driven directly by the injected {@link ThemeService};
 * the active version is provided by the parent as an input so the header stays
 * a passive display component with no data-fetching responsibility.
 */
@Component({
  selector: 'app-header',
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  /**
   * The currently active Node.js version, displayed as a badge.
   * `undefined` while the version list is still loading or when no version
   * is active; the template hides the badge in that case.
   */
  readonly activeVersion = input<InstalledNodeVersion | undefined>(undefined);

  /**
   * Theme service exposed to the template so the toggle button can read
   * `themeService.theme()` and call `themeService.toggle()` directly.
   * Public by design – this is the component's view-model for theming.
   */
  readonly themeService = inject(ThemeService);
}
