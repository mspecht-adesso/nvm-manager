import { Component, OnInit, OnDestroy, Output, EventEmitter, signal, computed, inject } from '@angular/core';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { NvmStatus } from '../../../models/nvm.models';

@Component({
  selector: 'app-status-card',
  standalone: true,
  imports: [CardComponent, LoadingStateComponent],
  templateUrl: './status-card.component.html',
  styleUrl: './status-card.component.scss',
})
export class StatusCardComponent implements OnInit, OnDestroy {
  private readonly nvmApi = inject(NvmApiService);

  @Output() nvmUpdate = new EventEmitter<string>();

  readonly status = signal<NvmStatus | null>(null);
  readonly loading = signal(false);
  readonly openingDir = signal(false);
  readonly openDirError = signal<string | null>(null);

  private openDirErrorTimer?: ReturnType<typeof setTimeout>;

  readonly updateAvailable = computed(() => {
    const s = this.status();
    if (!s?.nvmVersion || !s.nvmLatestVersion) return false;
    return s.nvmVersion !== s.nvmLatestVersion;
  });

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.openDirErrorTimer);
  }

  load(): void {
    this.loading.set(true);
    this.nvmApi.getStatus().subscribe({
      next: (s) => {
        this.status.set(s);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.status.set({ ok: false, error: err.message });
        this.loading.set(false);
      },
    });
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
