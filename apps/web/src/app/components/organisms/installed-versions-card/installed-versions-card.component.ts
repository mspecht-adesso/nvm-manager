import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { InstalledNodeVersion } from '../../../models/nvm.models';

/**
 * Card listing all locally installed Node.js versions (organism) with per-row
 * actions to activate or uninstall a version, plus a refresh control.
 *
 * This is a "dumb"/presentational component: it owns no data-fetching logic.
 * The parent supplies the version list and loading flags as inputs and reacts
 * to the emitted action outputs (typically delegating to {@link NvmStateService}).
 */
@Component({
  selector: 'app-installed-versions-card',
  imports: [CardComponent, LoadingStateComponent],
  templateUrl: './installed-versions-card.component.html',
  styleUrl: './installed-versions-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstalledVersionsCardComponent {
  /** The structured list of installed versions to render in the table. */
  readonly versions = input<InstalledNodeVersion[]>([]);

  /** Raw `nvm ls` stdout, shown verbatim in a collapsible/debug area. */
  readonly raw = input('');

  /** `true` while the installed-versions list itself is being (re)loaded. */
  readonly loading = input(false);

  /**
   * `true` while a separate nvm operation (install/use/uninstall) is in flight.
   * Used to disable the row action buttons so the user cannot start overlapping
   * operations. Kept distinct from {@link loading}, which only covers the list fetch.
   */
  readonly isLoading = input(false);

  /** Emits the version string the user wants to activate ("use"). */
  readonly useVersion = output<string>();

  /** Emits the version string the user wants to uninstall. */
  readonly uninstallVersion = output<string>();

  /** Emits when the user requests a manual reload of the list. */
  readonly refresh = output<void>();
}
