import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { InstalledNodeVersion, LogEvent } from '../../../models/nvm.models';

@Component({
  selector: 'app-remote-versions-card',
  standalone: true,
  imports: [FormsModule, CardComponent, LoadingStateComponent],
  templateUrl: './remote-versions-card.component.html',
  styleUrl: './remote-versions-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RemoteVersionsCardComponent {
  private readonly nvmApi = inject(NvmApiService);

  readonly installedVersions = input<InstalledNodeVersion[]>([]);
  readonly isLoading = input(false);

  readonly install = output<string>();
  readonly logged = output<LogEvent>();

  readonly remoteSearch = signal('');

  // Lazy: the resource stays idle until the user triggers loading the first time.
  private readonly shouldLoad = signal(false);
  private readonly remoteResource = rxResource({
    params: () => (this.shouldLoad() ? true : undefined),
    stream: () => this.nvmApi.getRemoteVersions(),
  });

  readonly remoteVersions = computed(() =>
    this.remoteResource.hasValue() ? (this.remoteResource.value()?.versions ?? []) : [],
  );
  readonly loading = this.remoteResource.isLoading;

  constructor() {
    effect(() => {
      const err = this.remoteResource.error();
      if (err) {
        this.logged.emit({
          message: 'Fehler beim Laden der Remote-Versionen: ' + (err as Error).message,
          type: 'error',
        });
      }
    });
  }

  readonly filteredVersions = computed(() => {
    const installedSet = new Set(this.installedVersions().map((v) => v.version));
    const query = this.remoteSearch().trim().toLowerCase();
    const available = this.remoteVersions().filter((v) => !installedSet.has(v.version));
    if (!query) {
      return available.slice(0, 30);
    }
    // A leading "v" denotes an explicit version search. Versions are stored
    // without the "v" (e.g. "22.11.0") but displayed as "v22.11.0":
    // "v" alone matches everything, "v19" matches versions starting with "19".
    if (query.startsWith('v')) {
      const versionPrefix = query.slice(1);
      return available.filter((v) => v.version.startsWith(versionPrefix)).slice(0, 100);
    }
    return available
      .filter((v) => v.version.includes(query) || (v.lts?.toLowerCase().includes(query) ?? false))
      .slice(0, 100);
  });

  readonly availableCount = computed(() => {
    const installedSet = new Set(this.installedVersions().map((v) => v.version));
    return this.remoteVersions().filter((v) => !installedSet.has(v.version)).length;
  });

  load(): void {
    if (this.shouldLoad()) {
      this.remoteResource.reload();
    } else {
      this.shouldLoad.set(true);
    }
  }
}
