import { Component, Input, Output, EventEmitter, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { InstalledNodeVersion, RemoteNodeVersion, RemoteVersionsResponse, LogEvent } from '../../../models/nvm.models';

@Component({
  selector: 'app-remote-versions-card',
  standalone: true,
  imports: [FormsModule, CardComponent, LoadingStateComponent],
  templateUrl: './remote-versions-card.component.html',
  styleUrl: './remote-versions-card.component.scss',
})
export class RemoteVersionsCardComponent {
  private readonly nvmApi = inject(NvmApiService);

  @Input() installedVersions: InstalledNodeVersion[] = [];
  @Input() isLoading = false;

  @Output() install = new EventEmitter<string>();
  @Output() logged = new EventEmitter<LogEvent>();

  readonly remoteVersions = signal<RemoteNodeVersion[]>([]);
  readonly remoteSearch = signal('');
  readonly loading = signal(false);

  readonly filteredVersions = computed(() => {
    const installedSet = new Set(this.installedVersions.map((v) => v.version));
    const query = this.remoteSearch().trim().toLowerCase();
    const available = this.remoteVersions().filter((v) => !installedSet.has(v.version));
    if (query) {
      return available
        .filter((v) => v.version.includes(query) || (v.lts?.toLowerCase().includes(query) ?? false))
        .slice(0, 100);
    }
    return available.slice(0, 30);
  });

  readonly availableCount = computed(() => {
    const installedSet = new Set(this.installedVersions.map((v) => v.version));
    return this.remoteVersions().filter((v) => !installedSet.has(v.version)).length;
  });

  load(): void {
    this.loading.set(true);
    this.remoteVersions.set([]);
    this.nvmApi.getRemoteVersions().subscribe({
      next: (res: RemoteVersionsResponse) => {
        this.remoteVersions.set(res.versions);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.logged.emit({ message: 'Fehler beim Laden der Remote-Versionen: ' + err.message, type: 'error' });
        this.loading.set(false);
      },
    });
  }
}
