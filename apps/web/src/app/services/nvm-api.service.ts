import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  NvmStatus,
  NvmCommandResult,
  InstalledVersionsResponse,
  AliasesResponse,
  RemoteVersionsResponse,
} from '../models/nvm.models';

/**
 * Thin HTTP client layer for communicating with the nvm-manager Express backend.
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
  // Status
  // ---------------------------------------------------------------------------

  /**
   * Fetches the nvm installation status and version information.
   *
   * Used by the status card to determine whether nvm is available and whether
   * a newer version of nvm itself can be installed.
   *
   * @returns Observable of {@link NvmStatus}, including `nvmVersion` and
   *          `nvmLatestVersion` when nvm is reachable.
   */
  getStatus(): Observable<NvmStatus> {
    return this.http.get<NvmStatus>(`${this.baseUrl}/status`);
  }

  // ---------------------------------------------------------------------------
  // Installed versions
  // ---------------------------------------------------------------------------

  /**
   * Lists all locally installed Node.js versions by running `nvm ls`.
   *
   * The response includes structured metadata per version (active, default,
   * stable flags) as well as the raw `stdout` for display in the log.
   *
   * @returns Observable of {@link InstalledVersionsResponse}.
   */
  getInstalledVersions(): Observable<InstalledVersionsResponse> {
    return this.http.get<InstalledVersionsResponse>(`${this.baseUrl}/versions/installed`);
  }

  /**
   * Lists all LTS versions available on the nvm remote index (`nvm ls-remote --lts`).
   *
   * This request can be slow (~1–3 s) because it fetches data from the GitHub
   * raw content CDN. The result is not cached server-side; the UI should avoid
   * polling it frequently.
   *
   * @returns Observable of {@link RemoteVersionsResponse}.
   */
  getRemoteVersions(): Observable<RemoteVersionsResponse> {
    return this.http.get<RemoteVersionsResponse>(`${this.baseUrl}/versions/remote`);
  }

  // ---------------------------------------------------------------------------
  // Version lifecycle: install / use / default / uninstall
  // ---------------------------------------------------------------------------

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
   * Returns all nvm aliases (`nvm alias`), including built-ins (`default`,
   * `stable`, `node`, `lts/*`) and any user-defined aliases.
   *
   * @returns Observable of {@link AliasesResponse}.
   */
  getAliases(): Observable<AliasesResponse> {
    return this.http.get<AliasesResponse>(`${this.baseUrl}/versions/aliases`);
  }

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
