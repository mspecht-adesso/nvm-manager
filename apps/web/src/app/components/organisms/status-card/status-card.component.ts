import { ChangeDetectionStrategy, Component, OnDestroy, output, signal, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { NvmStatus } from '../../../models/nvm.models';

/**
 * Status card (organism) showing nvm's installation state and version.
 *
 * Responsibilities:
 * - Fetch and display the nvm status (version, install directory) via `httpResource`.
 * - Detect whether a newer nvm version is available and offer a self-update,
 *   delegated to the parent through the {@link nvmUpdate} output.
 * - Open the `NVM_DIR` in the OS file manager, with transient inline error feedback.
 *
 * Unlike most cards, this organism fetches its own status data because the
 * information is self-contained and not shared with sibling components.
 */
@Component({
  selector: 'app-status-card',
  imports: [CardComponent, LoadingStateComponent],
  templateUrl: './status-card.component.html',
  styleUrl: './status-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusCardComponent implements OnDestroy {
  private readonly nvmApi = inject(NvmApiService);

  /**
   * Emits when the user triggers an nvm self-update. The payload is the target
   * version label (latest known nvm version, or `'latest'` as fallback) used
   * by the parent to drive the progress modal.
   */
  readonly nvmUpdate = output<string>();

  /** Reactive source for the `/api/status` endpoint (httpResource, stable in v22). */
  private readonly statusResource = httpResource<NvmStatus>(() => '/api/status');

  /** Current status payload, or `undefined` while loading / on error. */
  readonly status = computed(() =>
    this.statusResource.hasValue() ? this.statusResource.value() : undefined,
  );

  /** Loading flag for the status request, passed through to the template. */
  readonly loading = this.statusResource.isLoading;

  /** Human-readable status load error, or `null` when the request succeeded. */
  readonly statusError = computed(() => {
    const err = this.statusResource.error();
    return err ? (err as Error).message : null;
  });

  /** `true` while the "open NVM_DIR" request is in flight (disables the button). */
  readonly openingDir = signal(false);

  /** Transient error message for a failed "open directory" attempt; auto-cleared. */
  readonly openDirError = signal<string | null>(null);

  /** Handle for the timer that clears {@link openDirError}; cleaned up on destroy. */
  private openDirErrorTimer?: ReturnType<typeof setTimeout>;

  /**
   * `true` when the installed nvm version differs from the latest available one.
   * Returns `false` if either version is unknown, so the update prompt is only
   * shown when a reliable comparison is possible.
   */
  readonly updateAvailable = computed(() => {
    const s = this.status();
    if (!s?.nvmVersion || !s.nvmLatestVersion) return false;
    return s.nvmVersion !== s.nvmLatestVersion;
  });

  /** Clears the pending error-reset timer to avoid a callback after teardown. */
  ngOnDestroy(): void {
    clearTimeout(this.openDirErrorTimer);
  }

  /** Reloads the nvm status from the backend. */
  load(): void {
    this.statusResource.reload();
  }

  /**
   * Emits {@link nvmUpdate} with the latest known nvm version so the parent can
   * start the update flow. Falls back to `'latest'` when the version is unknown.
   */
  onNvmUpdate(): void {
    const latestVersion = this.status()?.nvmLatestVersion ?? 'latest';
    this.nvmUpdate.emit(latestVersion);
  }

  /**
   * Requests the backend to open the `NVM_DIR` folder in the system file manager.
   *
   * On failure the error message is shown inline and automatically cleared after
   * 5 seconds. Any previously scheduled clear timer is cancelled first so rapid
   * retries do not leave a stale timer running.
   */
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
