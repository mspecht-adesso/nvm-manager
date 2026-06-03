import { ChangeDetectionStrategy, Component, OnInit, effect, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type { NvmAlias, AliasesResponse, LogEvent, InstalledNodeVersion } from '../../../models/nvm.models';

@Component({
  selector: 'app-aliases-card',
  standalone: true,
  imports: [FormsModule, CardComponent, LoadingStateComponent],
  templateUrl: './aliases-card.component.html',
  styleUrl: './aliases-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AliasesCardComponent implements OnInit {
  private readonly nvmApi = inject(NvmApiService);

  readonly refreshTrigger = input(0);
  readonly installedVersions = input<InstalledNodeVersion[]>([]);

  readonly logged = output<LogEvent>();
  readonly aliasChanged = output<void>();

  readonly aliases = signal<NvmAlias[]>([]);
  readonly loading = signal(false);
  readonly editingAlias = signal<string | null>(null);
  readonly editingLtsAlias = signal<string | null>(null);

  editAliasTarget = '';
  ltsEditVersion = '';
  newAliasName = '';
  newAliasTarget = '';

  constructor() {
    effect(() => {
      if (this.refreshTrigger() > 0) this.load();
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.nvmApi.getAliases().subscribe({
      next: (res: AliasesResponse) => {
        this.aliases.set(res.aliases);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.logged.emit({ message: 'Fehler beim Laden der Aliases: ' + err.message, type: 'error' });
        this.loading.set(false);
      },
    });
  }

  startEdit(alias: NvmAlias): void {
    this.editingAlias.set(alias.name);
    const resolvedWithoutV = alias.resolved?.replace(/^v/, '') ?? '';
    const hasMatch = this.installedVersions().some((v) => v.version === resolvedWithoutV);
    this.editAliasTarget = hasMatch ? resolvedWithoutV : (this.installedVersions()[0]?.version ?? '');
  }

  cancelEdit(): void {
    this.editingAlias.set(null);
    this.editAliasTarget = '';
  }

  saveAlias(name: string): void {
    const target = this.editAliasTarget.trim();
    if (!target) return;
    this.nvmApi.setAlias(name, target).subscribe({
      next: () => {
        this.logged.emit({ message: `Alias '${name}' → '${target}' gesetzt.`, type: 'success' });
        this.editingAlias.set(null);
        this.editAliasTarget = '';
        this.load();
        this.aliasChanged.emit();
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Setzen des Alias '${name}': ${err.message}`, type: 'error' });
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
    this.ltsEditVersion = hasMatch ? resolvedWithoutV : (compatible[0]?.version ?? '');
  }

  cancelLtsEdit(): void {
    this.editingLtsAlias.set(null);
    this.ltsEditVersion = '';
  }

  saveLtsAlias(alias: NvmAlias): void {
    const version = this.ltsEditVersion.trim();
    if (!version) return;
    const codename = alias.name.slice('lts/'.length);
    this.nvmApi.setLtsAlias(codename, version).subscribe({
      next: () => {
        this.logged.emit({ message: `LTS-Alias '${alias.name}' → '${version}' gesetzt.`, type: 'success' });
        this.editingLtsAlias.set(null);
        this.ltsEditVersion = '';
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
    const name = this.newAliasName.trim();
    const target = this.newAliasTarget.trim();
    if (!name || !target) return;
    this.nvmApi.setAlias(name, target).subscribe({
      next: () => {
        this.logged.emit({ message: `Alias '${name}' → '${target}' angelegt.`, type: 'success' });
        this.newAliasName = '';
        this.newAliasTarget = '';
        this.load();
        this.aliasChanged.emit();
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Anlegen des Alias '${name}': ${err.message}`, type: 'error' });
      },
    });
  }

  deleteAlias(name: string): void {
    if (!confirm(`Alias '${name}' wirklich löschen?`)) return;

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
}
