import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NvmStateService } from './services/nvm-state.service';
import { InstallModalComponent } from './components/install-modal/install-modal.component';
import { AppHeaderComponent } from './components/organisms/app-header/app-header.component';
import { StatusCardComponent } from './components/organisms/status-card/status-card.component';
import { ActionCardComponent } from './components/organisms/action-card/action-card.component';
import { InstalledVersionsCardComponent } from './components/organisms/installed-versions-card/installed-versions-card.component';
import { AliasesCardComponent } from './components/organisms/aliases-card/aliases-card.component';
import { RemoteVersionsCardComponent } from './components/organisms/remote-versions-card/remote-versions-card.component';
import { LogCardComponent } from './components/organisms/log-card/log-card.component';
import { AppFooterComponent } from './components/organisms/app-footer/app-footer.component';

/**
 * Root component of the nvm-manager SPA (`<app-root>`).
 *
 * Acts purely as the composition shell: it imports and lays out the header,
 * the feature cards (status, actions, installed/remote versions, aliases, log),
 * the install/progress modal, and the footer. It contains no business logic of
 * its own.
 *
 * All shared state and action handlers live in {@link NvmStateService}, which is
 * exposed to the template via the {@link state} field. Child components bind to
 * `state.*` signals and forward their outputs to `state.on*()` methods, keeping
 * this component a thin, declarative container.
 */
@Component({
  selector: 'app-root',
  imports: [
    InstallModalComponent,
    AppHeaderComponent,
    StatusCardComponent,
    ActionCardComponent,
    InstalledVersionsCardComponent,
    AliasesCardComponent,
    RemoteVersionsCardComponent,
    LogCardComponent,
    AppFooterComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  /**
   * Central application state and action facade, bound throughout `app.html`.
   * `protected` so it is accessible from the template but not part of the
   * component's public API.
   */
  protected readonly state = inject(NvmStateService);
}
