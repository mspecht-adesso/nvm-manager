import { ChangeDetectionStrategy, Component, OnDestroy, output, signal, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';

@Component({
  selector: 'app-status-card',
  standalone: true,
  imports: [CardComponent, LoadingStateComponent],
  templateUrl: './status-card.component.html',
  styleUrl: './status-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusCardComponent implements OnDestroy {
  private readonly nvmApi = inject(NvmApiService);

  readonly nvmUpdate = output<string>();

  private readonly statusResource = rxResource({
    stream: () => this.nvmApi.getStatus(),
  });

  readonly status = computed(() =>
    this.statusResource.hasValue() ? this.statusResource.value() : undefined,
  );
  readonly loading = this.statusResource.isLoading;
  readonly statusError = computed(() => {
    const err = this.statusResource.error();
    return err ? (err as Error).message : null;
  });

  readonly openingDir = signal(false);
  readonly openDirError = signal<string | null>(null);

  private openDirErrorTimer?: ReturnType<typeof setTimeout>;

  readonly updateAvailable = computed(() => {
    const s = this.status();
    if (!s?.nvmVersion || !s.nvmLatestVersion) return false;
    return s.nvmVersion !== s.nvmLatestVersion;
  });

  ngOnDestroy(): void {
    clearTimeout(this.openDirErrorTimer);
  }

  load(): void {
    this.statusResource.reload();
  }

  onNvmUpdate(): void {
    const latestVersion = this.status()?.nvmLatestVersion ?? 'latest';
    this.nvmUpdate.emit(latestVersion);
  }

  openDir(): void {
    this.openingDir.set(true);
    clearTimeout(this.openDirErrorTimer);
    this.openDirError.set(null);
    this.nvmApi.openNvmDir().subscribe({
      next: () => this.openingDir.set(false),
      error: (err: Error) => {
        this.openingDir.set(false);
        this.openDirError.set(err.message);
        this.openDirErrorTimer = setTimeout(() => this.openDirError.set(null), 5000);
      },
    });
  }
}
