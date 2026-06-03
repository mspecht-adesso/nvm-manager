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

@Component({
  selector: 'app-root',
  standalone: true,
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
  protected readonly state = inject(NvmStateService);
}
