import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { NvmApiService } from './nvm-api.service';
import type {
  InstallModalState,
  InstalledVersionsResponse,
  LogEntry,
  LogEvent,
  NvmCommandResult,
} from '../models/nvm.models';

/**
 * Central application state service for the nvm-manager frontend.
 *
 * This service is the single source of truth for all mutable UI state:
 * - The list of installed Node.js versions (fetched via `rxResource`)
 * - The install/uninstall/use/update modal lifecycle
 * - The activity log shown to the user
 * - Auxiliary signals such as loading flags and version prefill
 *
 * Components inject this service and read from its public signals; they
 * trigger state mutations exclusively through the `on*` action methods.
 * This keeps components thin and free of HTTP subscription boilerplate.
 *
 * ## Data flow
 * ```
 * Component  →  onXxx()  →  NvmApiService  →  HTTP
 *                      ↓
 *              Signal update  →  Component template re-renders (OnPush)
 * ```
 */
@Injectable({ providedIn: 'root' })
export class NvmStateService {
  private readonly nvmApi = inject(NvmApiService);

  // ---------------------------------------------------------------------------
  // Public state signals
  // ---------------------------------------------------------------------------

  /**
   * Ordered list of log entries shown in the activity log panel.
   * Newest entry is at index 0; capped at 20 entries by {@link addLog}.
   */
  readonly log = signal<LogEntry[]>([]);

  /**
   * Global loading flag for operations that do not use the modal
   * (e.g. `onUse` / `onSetDefault` called directly from the version table).
   * Components use this to disable interactive controls during the request.
   */
  readonly isLoading = signal(false);

  /**
   * Controls the install/uninstall/update modal.
   * `null` means the modal is hidden; a non-null value passes the current
   * action and phase to `<app-install-modal>`.
   */
  readonly installModal = signal<InstallModalState>(null);

  /**
   * Pre-fills the version input in the install modal when the user clicks
   * "Use" on a version from the installed-versions list.
   * Allows the modal to display the selected version immediately on open.
   */
  readonly prefillVersion = signal('');

  /**
   * Monotonically increasing counter that child components watch to know when
   * they should reload the alias list from the backend.
   * Incremented after any operation that can change nvm aliases (use, set default).
   */
  readonly aliasesRefreshTrigger = signal(0);

  // ---------------------------------------------------------------------------
  // Installed versions resource (rxResource)
  // ---------------------------------------------------------------------------

  /**
   * Reactive data source for the installed-versions endpoint.
   *
   * `httpResource` (stable since Angular v22) issues the GET request and exposes
   * the full lifecycle (loading, value, error) as Signals, keeping the async
   * state inside the signal graph without any manual subscription. HTTP failures
   * are normalised to `Error` by the global `httpErrorInterceptor`. The resource
   * is reloaded by calling `installedResource.reload()`.
   */
  private readonly installedResource = httpResource<InstalledVersionsResponse>(
    () => '/api/versions/installed',
  );

  /**
   * The structured list of installed Node.js versions.
   * Returns an empty array while the resource is loading or in error state
   * so that templates do not need `@if (installedResource.hasValue())` guards.
   */
  readonly installedVersions = computed(() =>
    this.installedResource.hasValue() ? (this.installedResource.value()?.versions ?? []) : [],
  );

  /**
   * The raw `nvm ls` stdout string, displayed verbatim in the log area
   * for debugging purposes.
   */
  readonly installedRaw = computed(() =>
    this.installedResource.hasValue() ? (this.installedResource.value()?.stdout ?? '') : '',
  );

  /** Passes through the resource's loading state for use in templates. */
  readonly installedLoading = this.installedResource.isLoading;

  /**
   * The currently active Node.js version, derived from `installedVersions`.
   * Returns `undefined` while loading or if no version is marked active.
   */
  readonly activeVersion = computed(() => this.installedVersions().find((v) => v.active));

  // ---------------------------------------------------------------------------
  // Constructor – reactive side effects
  // ---------------------------------------------------------------------------

  constructor() {
    // Surface resource load errors in the activity log so the user is not left
    // with a silently empty version list.
    effect(() => {
      const err = this.installedResource.error();
      if (err) {
        this.addLog(
          'Fehler beim Laden der installierten Versionen: ' + (err as Error).message,
          'error',
        );
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  /**
   * Triggers a fresh reload of the installed-versions list from the backend.
   * Called automatically after install, uninstall, use, and set-default operations.
   */
  loadInstalledVersions(): void {
    this.installedResource.reload();
  }

  // ---------------------------------------------------------------------------
  // Action handlers – each follows the same pattern:
  //   1. Set loading flag + modal state to 'running'
  //   2. Add an info log entry
  //   3. Call NvmApiService
  //   4a. On success: update modal to 'success', reload affected data
  //   4b. On error:   update modal to 'error', surface message in log
  // ---------------------------------------------------------------------------

  /**
   * Installs a Node.js version and drives the progress modal through its lifecycle.
   *
   * @param version - Validated version string (e.g. `'22.11.0'`, `'lts/*'`).
   */
  onInstall(version: string): void {
    this.isLoading.set(true);
    this.installModal.set({ action: 'install', phase: 'running', version });
    this.addLog(`Installiere Node ${version} ...`, 'info');
    this.nvmApi.installVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} installiert. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.installModal.set({ action: 'install', phase: 'success', version });
        this.loadInstalledVersions();
      },
      error: (err: Error) => {
        this.addLog(`Fehler bei Installation von ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
        this.installModal.set({ action: 'install', phase: 'error', version, errorMessage: err.message });
      },
    });
  }

  /**
   * Activates a version selected from the installed-versions table and opens the modal.
   *
   * Differs from {@link onUse} in two ways:
   * 1. Sets `prefillVersion` so the version is pre-selected if the user opens
   *    the install modal again afterwards.
   * 2. Drives the `installModal` signal through `running → success/error`,
   *    giving the user visible feedback via the progress dialog.
   * 3. Increments `aliasesRefreshTrigger` on success because activating a
   *    version also rewrites the `default` alias.
   *
   * @param version - The version to activate (must be locally installed).
   */
  onUseFromList(version: string): void {
    this.prefillVersion.set(version);
    this.isLoading.set(true);
    this.installModal.set({ action: 'use', phase: 'running', version });
    this.addLog(`Aktiviere Node ${version} ...`, 'info');
    this.nvmApi.useVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} aktiviert. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.installModal.set({ action: 'use', phase: 'success', version });
        this.loadInstalledVersions();
        this.aliasesRefreshTrigger.update((n) => n + 1);
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Aktivieren von ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
        this.installModal.set({ action: 'use', phase: 'error', version, errorMessage: err.message });
      },
    });
  }

  /**
   * Activates a version silently, without opening the progress modal.
   *
   * Used by UI paths where a lightweight inline feedback (log entry + loading
   * spinner) is sufficient and opening a full modal dialog would feel disruptive
   * (e.g. a quick toggle in the status card).
   *
   * @param version - The version to activate (must be locally installed).
   */
  onUse(version: string): void {
    this.isLoading.set(true);
    this.addLog(`Aktiviere Node ${version} ...`, 'info');
    this.nvmApi.useVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} aktiviert. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.loadInstalledVersions();
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Aktivieren von ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Sets the `default` nvm alias to the given version without opening the modal.
   *
   * Also increments `aliasesRefreshTrigger` because the default alias entry
   * in the aliases panel needs to update.
   *
   * @param version - The version to assign as the nvm default alias.
   */
  onSetDefault(version: string): void {
    this.isLoading.set(true);
    this.addLog(`Setze Node ${version} als Default ...`, 'info');
    this.nvmApi.setDefaultVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} als Default gesetzt. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.loadInstalledVersions();
        this.aliasesRefreshTrigger.update((n) => n + 1);
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Setzen des Defaults für ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Uninstalls a Node.js version and drives the progress modal through its lifecycle.
   *
   * nvm refuses to uninstall the currently active version; callers are expected
   * to ensure the user has switched away from it before calling this method.
   *
   * @param version - Exact version string to remove (e.g. `'18.20.4'`).
   */
  onUninstall(version: string): void {
    this.isLoading.set(true);
    this.installModal.set({ action: 'uninstall', phase: 'running', version });
    this.addLog(`Deinstalliere Node ${version} ...`, 'info');
    this.nvmApi.uninstallVersion(version).subscribe({
      next: (res: NvmCommandResult) => {
        this.addLog(`Node ${version} deinstalliert. ${res.stdout.trim()}`, 'success');
        this.isLoading.set(false);
        this.installModal.set({ action: 'uninstall', phase: 'success', version });
        this.loadInstalledVersions();
      },
      error: (err: Error) => {
        this.addLog(`Fehler bei Deinstallation von ${version}: ${err.message}`, 'error');
        this.isLoading.set(false);
        this.installModal.set({ action: 'uninstall', phase: 'error', version, errorMessage: err.message });
      },
    });
  }

  /**
   * Triggers a self-update of nvm and drives the progress modal through its lifecycle.
   *
   * `targetVersion` is the version string shown in the modal UI (e.g. `'0.40.3'`);
   * it does not influence the update command itself – nvm always installs the
   * latest version from its install script.
   *
   * @param targetVersion - Latest nvm version string displayed to the user.
   */
  onNvmUpdate(targetVersion: string): void {
    this.isLoading.set(true);
    this.installModal.set({ action: 'nvm-update', phase: 'running', version: targetVersion });
    this.addLog(`Aktualisiere nvm auf ${targetVersion} ...`, 'info');
    this.nvmApi.updateNvm().subscribe({
      next: () => {
        this.addLog(`nvm wurde auf ${targetVersion} aktualisiert.`, 'success');
        this.isLoading.set(false);
        this.installModal.set({ action: 'nvm-update', phase: 'success', version: targetVersion });
      },
      error: (err: Error) => {
        this.addLog(`Fehler beim Aktualisieren von nvm: ${err.message}`, 'error');
        this.isLoading.set(false);
        this.installModal.set({ action: 'nvm-update', phase: 'error', version: targetVersion, errorMessage: err.message });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Modal control
  // ---------------------------------------------------------------------------

  /**
   * Resets the modal to its hidden state.
   * Called by the root component when `<app-install-modal>` emits `(closed)`.
   */
  closeInstallModal(): void {
    this.installModal.set(null);
  }

  // ---------------------------------------------------------------------------
  // Log forwarding
  // ---------------------------------------------------------------------------

  /**
   * Accepts a {@link LogEvent} emitted by a child component and appends it to
   * the central activity log. Allows child components to contribute log entries
   * without having direct write access to the `log` signal.
   *
   * @param event - The log event emitted by the component.
   */
  onLogged(event: LogEvent): void {
    this.addLog(event.message, event.type);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Appends a new entry to the activity log and enforces a maximum of 20 entries.
   *
   * Whitespace in the raw message is normalised (collapsed and trimmed) because
   * nvm output frequently contains leading/trailing newlines and irregular spacing.
   * The newest entry is prepended so the log renders in reverse-chronological order.
   *
   * @param message - Raw message text (will be whitespace-normalised).
   * @param type    - Severity level controlling the log entry's visual styling.
   */
  private addLog(message: string, type: LogEntry['type']): void {
    const trimmed = message.replace(/\s+/g, ' ').trim();
    this.log.update((entries) => [
      { message: trimmed, type, timestamp: new Date() },
      // Keep at most 20 entries to prevent unbounded memory growth during long sessions.
      ...entries.slice(0, 19),
    ]);
  }
}
