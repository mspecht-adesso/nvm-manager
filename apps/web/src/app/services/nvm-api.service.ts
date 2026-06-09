import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { NvmCommandResult } from '../models/nvm.models';

/**
 * Thin HTTP client layer for the nvm-manager Express backend's **mutation**
 * endpoints (install, use, set default/stable, uninstall, alias management,
 * nvm self-update, open dir).
 *
 * Read-only endpoints (status, installed/remote versions, aliases) are fetched
 * declaratively via `httpResource` (stable since Angular v22) in the components
 * and {@link NvmStateService} that own that state, so they are not wrapped here.
 *
 * Every method returns a cold `Observable` that executes the HTTP request only
 * when subscribed to. Callers (components or {@link NvmStateService}) are
 * responsible for subscribing and handling errors.
 *
 * Error normalisation (HTTP status → `Error`) is handled globally by the
 * `httpErrorInterceptor` so individual methods do not need `catchError`.
 *
 * The backend runs on `127.0.0.1:3789`; the Angular dev server proxies
 * `/api/*` to it, so all paths here are relative to the same origin.
 */
@Injectable({ providedIn: 'root' })
export class NvmApiService {
  private readonly http = inject(HttpClient);

  /** Common prefix for all backend routes; kept here to avoid repetition. */
  private readonly baseUrl = '/api';

  // ---------------------------------------------------------------------------
  // Version lifecycle: install / use / default / uninstall
  // ---------------------------------------------------------------------------
  //
  // Note: read-only endpoints (status, installed/remote versions, aliases) are
  // consumed directly via `httpResource` in the respective components/services,
  // so this service only wraps the imperative mutation endpoints.

  /**
   * Installs a Node.js version via `nvm install <version>`.
   *
   * Downloads the compiled binary from nodejs.org; the operation can take
   * 30–180 s depending on network speed and server load.
   *
   * @param version - A validated version string (e.g. `'22.11.0'`, `'lts/*'`).
   * @returns Observable that completes with stdout/stderr on success, or errors
   *          if nvm returns a non-zero exit code.
   */
  installVersion(version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/install`, { version });
  }

  /**
   * Activates a version for new shells via `nvm alias default <version>`.
   *
   * **Important:** Despite the name "use", the backend calls `nvm alias default`
   * rather than `nvm use`, because `nvm use` only affects the current shell
   * process and the change would be lost immediately. Setting the alias is the
   * only way to persistently change the active version.
   *
   * @param version - The version to activate (must already be installed).
   */
  useVersion(version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/use`, { version });
  }

  /**
   * Explicitly sets the `default` nvm alias to the given version.
   *
   * Functionally equivalent to {@link useVersion} but used in a separate UI
   * context (the "Set default" action in the installed-versions table).
   *
   * @param version - The version to set as default.
   */
  setDefaultVersion(version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/default`, { version });
  }

  /**
   * Points the `stable` nvm alias at the given version (`nvm alias stable <version>`).
   *
   * @param version - The version to assign to the `stable` alias.
   */
  setStableVersion(version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/stable`, { version });
  }

  /**
   * Uninstalls a locally installed Node.js version via `nvm uninstall <version>`.
   *
   * nvm prevents uninstalling the currently active version; callers should
   * switch to a different version first when needed.
   *
   * @param version - The exact version string to remove (e.g. `'18.20.4'`).
   */
  uninstallVersion(version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/uninstall`, { version });
  }

  // ---------------------------------------------------------------------------
  // Aliases
  // ---------------------------------------------------------------------------

  /**
   * Creates or updates a user-defined nvm alias (`nvm alias <name> <target>`).
   *
   * @param name   - Alias name (e.g. `'my-project'`).
   * @param target - Version or alias to point to (e.g. `'22.11.0'`).
   */
  setAlias(name: string, target: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/aliases`, { name, target });
  }

  /**
   * Deletes a user-defined alias by name (`nvm unalias <name>`).
   *
   * The name is URL-encoded before being interpolated into the path to handle
   * aliases that contain special characters such as `/` or spaces.
   *
   * @param name - The alias name to delete.
   */
  deleteAlias(name: string): Observable<NvmCommandResult> {
    return this.http.delete<NvmCommandResult>(
      `${this.baseUrl}/versions/aliases/${encodeURIComponent(name)}`,
    );
  }

  /**
   * Points an LTS codename alias at a specific version
   * (`nvm alias lts/<codename> <version>`).
   *
   * @param codename - LTS release codename (e.g. `'iron'`, `'hydrogen'`).
   * @param version  - Target version string (e.g. `'20.18.0'`).
   */
  setLtsAlias(codename: string, version: string): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/versions/aliases/lts`, {
      codename,
      version,
    });
  }

  /**
   * Removes an LTS codename alias (`nvm unalias lts/<codename>`).
   *
   * The codename is URL-encoded for the same reason as in {@link deleteAlias}.
   *
   * @param codename - LTS release codename to remove (e.g. `'iron'`).
   */
  deleteLtsAlias(codename: string): Observable<NvmCommandResult> {
    return this.http.delete<NvmCommandResult>(
      `${this.baseUrl}/versions/aliases/lts/${encodeURIComponent(codename)}`,
    );
  }

  // ---------------------------------------------------------------------------
  // nvm self-management
  // ---------------------------------------------------------------------------

  /**
   * Triggers a self-update of nvm via the install script
   * (`curl … nvm/install.sh | bash`).
   *
   * The backend runs the update in a bash subshell and streams stdout/stderr
   * back. Requires an active internet connection and that `NVM_DIR` is a valid
   * git repository (the official nvm install method uses git).
   *
   * @returns Observable that completes when the update script exits.
   */
  updateNvm(): Observable<NvmCommandResult> {
    return this.http.post<NvmCommandResult>(`${this.baseUrl}/nvm/update`, {});
  }

  /**
   * Asks the backend to open the `NVM_DIR` folder in the system file manager.
   *
   * Uses the OS-native open command (`open` on macOS, `xdg-open` on Linux).
   * The response only confirms that the command was dispatched; it does not
   * wait for the file manager window to appear.
   *
   * @returns Observable of `{ ok: true }` on success.
   */
  openNvmDir(): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.baseUrl}/nvm/open-dir`, {});
  }
}
