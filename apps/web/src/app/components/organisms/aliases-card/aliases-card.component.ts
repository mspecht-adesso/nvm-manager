import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { NvmAlias, LogEvent, InstalledNodeVersion, InstallModalState } from '../../../models/nvm.models';

@Component({
  selector: 'app-aliases-card',
  standalone: true,
  imports: [FormsModule, CardComponent, LoadingStateComponent],
  templateUrl: './aliases-card.component.html',
  styleUrl: './aliases-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AliasesCardComponent {
  private readonly nvmApi = inject(NvmApiService);

  readonly refreshTrigger = input(0);
  readonly installedVersions = input<InstalledNodeVersion[]>([]);

  readonly logged = output<LogEvent>();
  readonly aliasChanged = output<void>();
  readonly modalStateChange = output<InstallModalState>();

  // The resource reloads automatically whenever `refreshTrigger` changes.
  private readonly aliasesResource = rxResource({
    params: () => this.refreshTrigger(),
    stream: () => this.nvmApi.getAliases(),
  });

  readonly aliases = computed(() =>
    this.aliasesResource.hasValue() ? (this.aliasesResource.value()?.aliases ?? []) : [],
  );
  readonly loading = this.aliasesResource.isLoading;
  readonly editingAlias = signal<string | null>(null);
  readonly editingLtsAlias = signal<string | null>(null);
  readonly confirmPendingAlias = signal<string | null>(null);

  readonly editAliasTarget = signal('');
  readonly ltsEditVersion = signal('');
  readonly newAliasName = signal('');
  readonly newAliasTarget = signal('');

  constructor() {
    effect(() => {
      const err = this.aliasesResource.error();
      if (err) {
        this.logged.emit({
          message: 'Fehler beim Laden der Aliases: ' + (err as Error).message,
          type: 'error',
        });
      }
    });
  }

  load(): void {
    this.aliasesResource.reload();
  }

  startEdit(alias: NvmAlias): void {
    this.editingAlias.set(alias.name);
    const resolvedWithoutV = alias.resolved?.replace(/^v/, '') ?? '';
    const hasMatch = this.installedVersions().some((v) => v.version === resolvedWithoutV);
    this.editAliasTarget.set(hasMatch ? resolvedWithoutV : (this.installedVersions()[0]?.version ?? ''));
  }

  cancelEdit(): void {
    this.editingAlias.set(null);
    this.editAliasTarget.set('');
  }

  saveAlias(name: string): void {
    const target = this.editAliasTarget().trim();
    if (!target) return;
    // Beim Default-Alias erhält der Nutzer zusätzlich ein Modal mit dem Fortschritt.
    const withModal = name === 'default';
    if (withModal) {
      this.modalStateChange.emit({ action: 'default', phase: 'running', version: target });
    }
    this.nvmApi.setAlias(name, target).subscribe({
      next: () => {
        this.logged.emit({ message: `Alias '${name}' → '${target}' gesetzt.`, type: 'success' });
        this.editingAlias.set(null);
        this.editAliasTarget.set('');
        this.load();
        this.aliasChanged.emit();
        if (withModal) {
          this.modalStateChange.emit({ action: 'default', phase: 'success', version: target });
        }
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Setzen des Alias '${name}': ${err.message}`, type: 'error' });
        if (withModal) {
          this.modalStateChange.emit({ action: 'default', phase: 'error', version: target, errorMessage: err.message });
        }
      },
    });
  }

  /**
   * Returns the installed versions that are compatible with the given LTS alias.
   * The major version is extracted from alias.target (e.g. "v24.16.0" → 24).
   * For lts/* (wildcard) or unknown targets all installed versions are returned.
   */
  ltsCompatibleVersions(alias: NvmAlias): InstalledNodeVersion[] {
    if (alias.name === 'lts/*') return this.installedVersions();
    const majorMatch = /^v?(\d+)\./.exec(alias.target);
    if (!majorMatch) return this.installedVersions();
    const major = majorMatch[1];
    const filtered = this.installedVersions().filter((v) => v.version.startsWith(`${major}.`));
    return filtered.length > 0 ? filtered : this.installedVersions();
  }

  startLtsEdit(alias: NvmAlias): void {
    this.editingLtsAlias.set(alias.name);
    const compatible = this.ltsCompatibleVersions(alias);
    const resolvedWithoutV = alias.resolved?.replace(/^v/, '') ?? '';
    const hasMatch = compatible.some((v) => v.version === resolvedWithoutV);
    this.ltsEditVersion.set(hasMatch ? resolvedWithoutV : (compatible[0]?.version ?? ''));
  }

  cancelLtsEdit(): void {
    this.editingLtsAlias.set(null);
    this.ltsEditVersion.set('');
  }

  saveLtsAlias(alias: NvmAlias): void {
    const version = this.ltsEditVersion().trim();
    if (!version) return;
    const codename = alias.name.slice('lts/'.length);
    this.nvmApi.setLtsAlias(codename, version).subscribe({
      next: () => {
        this.logged.emit({ message: `LTS-Alias '${alias.name}' → '${version}' gesetzt.`, type: 'success' });
        this.editingLtsAlias.set(null);
        this.ltsEditVersion.set('');
        this.load();
        this.aliasChanged.emit();
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Setzen von '${alias.name}': ${err.message}`, type: 'error' });
      },
    });
  }

  setAsDefault(alias: NvmAlias): void {
    this.nvmApi.setDefaultVersion(alias.name).subscribe({
      next: () => {
        this.logged.emit({ message: `Default → '${alias.name}' gesetzt.`, type: 'success' });
        this.load();
        this.aliasChanged.emit();
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Setzen des Defaults: ${err.message}`, type: 'error' });
      },
    });
  }

  setAsStable(alias: NvmAlias): void {
    this.nvmApi.setStableVersion(alias.name).subscribe({
      next: () => {
        this.logged.emit({ message: `Stable → '${alias.name}' gesetzt.`, type: 'success' });
        this.load();
        this.aliasChanged.emit();
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Setzen von Stable: ${err.message}`, type: 'error' });
      },
    });
  }

  createAlias(): void {
    const name = this.newAliasName().trim();
    const target = this.newAliasTarget().trim();
    if (!name || !target) return;
    this.nvmApi.setAlias(name, target).subscribe({
      next: () => {
        this.logged.emit({ message: `Alias '${name}' → '${target}' angelegt.`, type: 'success' });
        this.newAliasName.set('');
        this.newAliasTarget.set('');
        this.load();
        this.aliasChanged.emit();
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Anlegen des Alias '${name}': ${err.message}`, type: 'error' });
      },
    });
  }

  deleteAlias(name: string): void {
    this.confirmPendingAlias.set(name);
  }

  confirmDelete(): void {
    const name = this.confirmPendingAlias();
    if (!name) return;
    this.confirmPendingAlias.set(null);

    const request$ = name.startsWith('lts/')
      ? this.nvmApi.deleteLtsAlias(name.slice('lts/'.length))
      : this.nvmApi.deleteAlias(name);

    request$.subscribe({
      next: () => {
        this.logged.emit({ message: `Alias '${name}' gelöscht.`, type: 'success' });
        this.load();
        this.aliasChanged.emit();
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Löschen des Alias '${name}': ${err.message}`, type: 'error' });
      },
    });
  }

  cancelDelete(): void {
    this.confirmPendingAlias.set(null);
  }
}
