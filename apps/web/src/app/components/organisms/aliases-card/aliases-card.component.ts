import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NvmApiService } from '../../../services/nvm-api.service';
import { CardComponent } from '../../molecules/card/card.component';
import { LoadingStateComponent } from '../../atoms/loading-state/loading-state.component';
import type {
  NvmAlias,
  AliasesResponse,
  LogEvent,
  InstalledNodeVersion,
  InstallModalState,
  InstallModalAction,
} from '../../../models/nvm.models';

/**
 * Aliases card (organism) for viewing and managing nvm aliases.
 *
 * Supports three categories of aliases with slightly different handling:
 * - The `default` alias (dedicated wording in the modal via the `'default'` action).
 * - LTS codename aliases (`lts/<codename>`), edited with version compatibility filtering.
 * - Arbitrary user-defined aliases (generic `'alias'` action).
 *
 * Unlike the other cards, this component performs nvm calls directly (create,
 * edit, delete, set-default, set-stable) because alias management is a
 * self-contained concern. It communicates with the rest of the app through
 * three outputs:
 * - {@link logged} – appends an entry to the central activity log.
 * - {@link aliasChanged} – notifies the parent so dependent views can refresh.
 * - {@link modalStateChange} – drives the shared install/progress modal.
 *
 * The alias list reloads automatically whenever {@link refreshTrigger} changes,
 * which the parent increments after any operation that can affect aliases.
 */
@Component({
  selector: 'app-aliases-card',
  imports: [FormsModule, CardComponent, LoadingStateComponent],
  templateUrl: './aliases-card.component.html',
  styleUrl: './aliases-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AliasesCardComponent {
  private readonly nvmApi = inject(NvmApiService);

  /**
   * Counter input; any change triggers an automatic reload of the alias list.
   * The parent bumps this after external operations (e.g. activating a version)
   * that implicitly modify aliases.
   */
  readonly refreshTrigger = input(0);

  /** Installed versions, used to populate and filter the edit dropdowns. */
  readonly installedVersions = input<InstalledNodeVersion[]>([]);

  /** Emits log events (success/error) for the central activity log. */
  readonly logged = output<LogEvent>();

  /** Emits whenever an alias was created, changed, or deleted so siblings can refresh. */
  readonly aliasChanged = output<void>();

  /** Drives the shared install/progress modal during alias edits. */
  readonly modalStateChange = output<InstallModalState>();

  /**
   * Reactive source for the aliases endpoint (httpResource, stable in v22).
   * Auto-loads once on creation; an effect in the constructor reloads it whenever
   * {@link refreshTrigger} changes.
   */
  private readonly aliasesResource = httpResource<AliasesResponse>(
    () => '/api/versions/aliases',
  );

  /** The current list of aliases, or an empty array while loading / on error. */
  readonly aliases = computed(() =>
    this.aliasesResource.hasValue() ? (this.aliasesResource.value()?.aliases ?? []) : [],
  );

  /** Loading flag passed through to the template. */
  readonly loading = this.aliasesResource.isLoading;

  /** Name of the regular alias currently being edited inline, or `null`. */
  readonly editingAlias = signal<string | null>(null);

  /** Name of the LTS alias currently being edited inline, or `null`. */
  readonly editingLtsAlias = signal<string | null>(null);

  /** Name of the alias awaiting delete confirmation, or `null`. */
  readonly confirmPendingAlias = signal<string | null>(null);

  /** Two-way-bound target version for the regular-alias edit form. */
  readonly editAliasTarget = signal('');

  /** Two-way-bound target version for the LTS-alias edit form. */
  readonly ltsEditVersion = signal('');

  /** Two-way-bound name field for the "create new alias" form. */
  readonly newAliasName = signal('');

  /** Two-way-bound target field for the "create new alias" form. */
  readonly newAliasTarget = signal('');

  constructor() {
    // The resource auto-loads once on creation. Reload it whenever the parent
    // bumps refreshTrigger after an external operation that can change aliases.
    // The initial trigger value is captured so the very first run does not
    // issue a redundant duplicate request.
    let previousTrigger = this.refreshTrigger();
    effect(() => {
      const trigger = this.refreshTrigger();
      if (trigger !== previousTrigger) {
        previousTrigger = trigger;
        this.aliasesResource.reload();
      }
    });

    // Surface alias-list load failures in the central activity log.
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

  /** Reloads the alias list from the backend. */
  load(): void {
    this.aliasesResource.reload();
  }

  /**
   * Opens the inline editor for a regular alias and pre-selects a target version.
   *
   * The alias's currently resolved version (with any leading `v` stripped) is
   * pre-selected if it is among the installed versions; otherwise the first
   * installed version is used as a sensible default.
   *
   * @param alias - The alias to edit.
   */
  startEdit(alias: NvmAlias): void {
    this.editingAlias.set(alias.name);
    const resolvedWithoutV = alias.resolved?.replace(/^v/, '') ?? '';
    const hasMatch = this.installedVersions().some((v) => v.version === resolvedWithoutV);
    this.editAliasTarget.set(hasMatch ? resolvedWithoutV : (this.installedVersions()[0]?.version ?? ''));
  }

  /** Closes the regular-alias editor and resets its form field. */
  cancelEdit(): void {
    this.editingAlias.set(null);
    this.editAliasTarget.set('');
  }

  /**
   * Persists an edited regular alias via the nvm API and drives the modal.
   *
   * The `default` alias keeps its dedicated `'default'` action (for distinct
   * modal wording); every other alias uses the generic `'alias'` action.
   * On success the editor closes, the list reloads, and {@link aliasChanged} fires.
   *
   * @param name - The alias name being saved.
   */
  saveAlias(name: string): void {
    const target = this.editAliasTarget().trim();
    if (!target) return;
    // The default alias keeps its dedicated 'default' action for distinct modal
    // wording; all other aliases (e.g. 'stable', custom aliases) use 'alias'.
    const action: InstallModalAction = name === 'default' ? 'default' : 'alias';
    const aliasName = name === 'default' ? undefined : name;
    this.modalStateChange.emit({ action, phase: 'running', version: target, alias: aliasName });
    this.nvmApi.setAlias(name, target).subscribe({
      next: () => {
        this.logged.emit({ message: `Alias '${name}' → '${target}' gesetzt.`, type: 'success' });
        this.editingAlias.set(null);
        this.editAliasTarget.set('');
        this.load();
        this.aliasChanged.emit();
        this.modalStateChange.emit({ action, phase: 'success', version: target, alias: aliasName });
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Setzen des Alias '${name}': ${err.message}`, type: 'error' });
        this.modalStateChange.emit({
          action,
          phase: 'error',
          version: target,
          alias: aliasName,
          errorMessage: err.message,
        });
      },
    });
  }

  /**
   * Returns the installed versions that are compatible with the given LTS alias.
   *
   * The major version is extracted from `alias.target` (e.g. `"v24.16.0"` → `24`)
   * and used to filter the installed versions. For the `lts/*` wildcard, an
   * unparseable target, or when no installed version matches, all installed
   * versions are returned as a fallback.
   *
   * @param alias - The LTS alias whose compatible versions are requested.
   * @returns Installed versions matching the alias's major version (or all of them as fallback).
   */
  ltsCompatibleVersions(alias: NvmAlias): InstalledNodeVersion[] {
    if (alias.name === 'lts/*') return this.installedVersions();
    const majorMatch = /^v?(\d+)\./.exec(alias.target);
    if (!majorMatch) return this.installedVersions();
    const major = majorMatch[1];
    const filtered = this.installedVersions().filter((v) => v.version.startsWith(`${major}.`));
    return filtered.length > 0 ? filtered : this.installedVersions();
  }

  /**
   * Opens the inline editor for an LTS alias and pre-selects a compatible version.
   * Selection logic mirrors {@link startEdit} but is constrained to the versions
   * returned by {@link ltsCompatibleVersions}.
   *
   * @param alias - The LTS alias to edit.
   */
  startLtsEdit(alias: NvmAlias): void {
    this.editingLtsAlias.set(alias.name);
    const compatible = this.ltsCompatibleVersions(alias);
    const resolvedWithoutV = alias.resolved?.replace(/^v/, '') ?? '';
    const hasMatch = compatible.some((v) => v.version === resolvedWithoutV);
    this.ltsEditVersion.set(hasMatch ? resolvedWithoutV : (compatible[0]?.version ?? ''));
  }

  /** Closes the LTS-alias editor and resets its form field. */
  cancelLtsEdit(): void {
    this.editingLtsAlias.set(null);
    this.ltsEditVersion.set('');
  }

  /**
   * Persists an edited LTS alias via the nvm API and drives the modal.
   *
   * The codename is derived by stripping the `lts/` prefix from the alias name
   * (e.g. `"lts/iron"` → `"iron"`). On success the editor closes, the list
   * reloads, and {@link aliasChanged} fires.
   *
   * @param alias - The LTS alias being saved.
   */
  saveLtsAlias(alias: NvmAlias): void {
    const version = this.ltsEditVersion().trim();
    if (!version) return;
    const codename = alias.name.slice('lts/'.length);
    this.modalStateChange.emit({ action: 'alias', phase: 'running', version, alias: alias.name });
    this.nvmApi.setLtsAlias(codename, version).subscribe({
      next: () => {
        this.logged.emit({ message: `LTS-Alias '${alias.name}' → '${version}' gesetzt.`, type: 'success' });
        this.editingLtsAlias.set(null);
        this.ltsEditVersion.set('');
        this.load();
        this.aliasChanged.emit();
        this.modalStateChange.emit({ action: 'alias', phase: 'success', version, alias: alias.name });
      },
      error: (err: Error) => {
        this.logged.emit({ message: `Fehler beim Setzen von '${alias.name}': ${err.message}`, type: 'error' });
        this.modalStateChange.emit({
          action: 'alias',
          phase: 'error',
          version,
          alias: alias.name,
          errorMessage: err.message,
        });
      },
    });
  }

  /**
   * Points the `default` alias at the given alias's name (`nvm alias default <name>`).
   * Reloads the list and emits {@link aliasChanged} on success.
   *
   * @param alias - The alias to promote to the default.
   */
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

  /**
   * Points the `stable` alias at the given alias's name (`nvm alias stable <name>`).
   * Reloads the list and emits {@link aliasChanged} on success.
   *
   * @param alias - The alias to assign to `stable`.
   */
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

  /**
   * Creates a new user-defined alias from the "create alias" form fields.
   * No-op if either the name or target is empty. Clears the form, reloads the
   * list, and emits {@link aliasChanged} on success.
   */
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

  /**
   * Requests deletion of an alias by marking it as pending confirmation.
   * This does not delete anything yet – it opens the confirmation prompt;
   * the actual removal happens in {@link confirmDelete}.
   *
   * @param name - The alias name the user wants to delete.
   */
  deleteAlias(name: string): void {
    this.confirmPendingAlias.set(name);
  }

  /**
   * Confirms and executes the pending alias deletion.
   *
   * LTS aliases (`lts/<codename>`) are removed via the dedicated LTS endpoint;
   * all other aliases use the regular delete endpoint. No-op if nothing is
   * pending. Reloads the list and emits {@link aliasChanged} on success.
   */
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

  /** Dismisses the delete confirmation prompt without removing the alias. */
  cancelDelete(): void {
    this.confirmPendingAlias.set(null);
  }
}
