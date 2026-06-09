import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { InstalledNodeVersion, LogEvent } from '../../../models/nvm.models';

/**
 * Remote-versions card (organism) that lets the user browse and search the
 * Node.js versions available from the nvm remote index and install one.
 *
 * Because the remote list is large and slow to fetch (~500 KB from a CDN), the
 * data is loaded lazily: nothing is requested until the user explicitly calls
 * {@link load} the first time. Already-installed versions are filtered out, and
 * the result set is searched and capped client-side for performance.
 *
 * Installation itself is delegated to the parent via the {@link install} output;
 * the card only fetches and filters the catalogue.
 */
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

  /** Locally installed versions, used to hide already-installed entries. */
  readonly installedVersions = input<InstalledNodeVersion[]>([]);

  /** `true` while an nvm operation is in flight; disables the install buttons. */
  readonly isLoading = input(false);

  /** Emits the version string the user chose to install. */
  readonly install = output<string>();

  /** Forwards load errors to the parent's central activity log. */
  readonly logged = output<LogEvent>();

  /** Two-way-bound search query for filtering the remote version list. */
  readonly remoteSearch = signal('');

  /**
   * Gate that keeps the resource idle until the first {@link load} call.
   * `rxResource` only runs its stream when `params()` returns a defined value,
   * so this flag implements lazy loading without a manual subscription.
   */
  private readonly shouldLoad = signal(false);

  /** Reactive source for the remote-versions endpoint; idle until {@link shouldLoad} is set. */
  private readonly remoteResource = rxResource({
    params: () => (this.shouldLoad() ? true : undefined),
    stream: () => this.nvmApi.getRemoteVersions(),
  });

  /** Full list of remote versions, or an empty array while idle/loading/on error. */
  readonly remoteVersions = computed(() =>
    this.remoteResource.hasValue() ? (this.remoteResource.value()?.versions ?? []) : [],
  );

  /** Loading flag passed through to the template. */
  readonly loading = this.remoteResource.isLoading;

  constructor() {
    // Surface remote-fetch failures in the central log rather than failing silently.
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

  /**
   * The list actually rendered: remote versions minus already-installed ones,
   * narrowed by the search query and capped to keep the DOM small.
   *
   * Search semantics:
   * - Empty query → first 30 available versions.
   * - Leading `'v'` → explicit version-number search. Versions are stored
   *   without the `v` prefix (e.g. `"22.11.0"`) but shown as `"v22.11.0"`, so
   *   `"v"` alone matches everything and `"v19"` matches versions starting with `19`.
   * - Otherwise → substring match against the version number or the LTS codename.
   *
   * Non-empty searches are capped at 100 results.
   */
  readonly filteredVersions = computed(() => {
    const installedSet = new Set(this.installedVersions().map((v) => v.version));
    const query = this.remoteSearch().trim().toLowerCase();
    const available = this.remoteVersions().filter((v) => !installedSet.has(v.version));
    if (!query) {
      return available.slice(0, 30);
    }
    if (query.startsWith('v')) {
      const versionPrefix = query.slice(1);
      return available.filter((v) => v.version.startsWith(versionPrefix)).slice(0, 100);
    }
    return available
      .filter((v) => v.version.includes(query) || (v.lts?.toLowerCase().includes(query) ?? false))
      .slice(0, 100);
  });

  /** Total number of installable (not-yet-installed) remote versions, ignoring the search filter. */
  readonly availableCount = computed(() => {
    const installedSet = new Set(this.installedVersions().map((v) => v.version));
    return this.remoteVersions().filter((v) => !installedSet.has(v.version)).length;
  });

  /**
   * Loads the remote list on first call, or reloads it on subsequent calls.
   *
   * The first invocation flips {@link shouldLoad}, which activates the resource;
   * later invocations trigger an explicit reload since the resource is already active.
   */
  load(): void {
    if (this.shouldLoad()) {
      this.remoteResource.reload();
    } else {
      this.shouldLoad.set(true);
    }
  }
}
