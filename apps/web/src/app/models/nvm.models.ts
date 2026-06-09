/**
 * Frontend-side type definitions for the nvm-manager API and UI state.
 *
 * These mirror the JSON shapes returned by the Express backend (`apps/api`).
 * The two apps are separate npm packages and intentionally do not share a types
 * module, so these definitions are the frontend's own contract for the API.
 */

/**
 * Raw output of an nvm shell command, common to most API responses.
 * Surfaced in the UI's log/debug area so users can inspect what nvm actually printed.
 */
export type NvmCommandResult = {
  /** Standard output captured from the nvm command. */
  stdout: string;
  /** Standard error captured from the nvm command (may be empty on success). */
  stderr: string;
};

/**
 * A single Node.js version available from the nvm remote index
 * (`nvm ls-remote`).
 */
export type RemoteNodeVersion = {
  /** Version number without a leading `v`, e.g. `"22.11.0"`. */
  version: string;
  /**
   * LTS codename if this version belongs to an LTS line (e.g. `"Jod"`),
   * or `null` for non-LTS (current/odd) releases.
   */
  lts: string | null;
};

/** Response for the remote-versions endpoint: command output plus the parsed list. */
export type RemoteVersionsResponse = NvmCommandResult & {
  /** All Node.js versions available for installation from the remote index. */
  versions: RemoteNodeVersion[];
};

/**
 * Health/status information about the local nvm installation,
 * returned by `GET /api/status`.
 */
export type NvmStatus = {
  /** `true` when nvm is installed and reachable; `false` indicates a setup problem. */
  ok: boolean;
  /** Currently installed nvm version (e.g. `"0.40.1"`); absent when nvm is unavailable. */
  nvmVersion?: string;
  /** Latest nvm version available upstream, used to detect whether an update is possible. */
  nvmLatestVersion?: string;
  /** Resolved `NVM_DIR` path on the host filesystem. */
  nvmDir?: string;
  /** Human-readable error message present only when {@link ok} is `false`. */
  error?: string;
};

/**
 * A single locally installed Node.js version with its nvm-assigned flags.
 * Parsed from `nvm ls`; the boolean flags are mutually informative rather than
 * mutually exclusive (e.g. a version can be both `active` and `default`).
 */
export type InstalledNodeVersion = {
  /** Version number without a leading `v`, e.g. `"22.11.0"`. */
  version: string;
  /** `true` if this is the version currently in use by the backend's shell. */
  active: boolean;
  /** `true` if this version is the nvm `default` alias target. */
  default: boolean;
  /** `true` for the system-provided Node.js (outside nvm's control). */
  system: boolean;
  /** `true` if this version is the target of the `stable` alias. */
  stable: boolean;
  /** `true` if this version is the target of the `unstable` alias. */
  unstable: boolean;
  /** `true` if this entry is an io.js version (legacy nvm support). */
  iojs: boolean;
};

/** Response for the installed-versions endpoint: command output plus the parsed list. */
export type InstalledVersionsResponse = NvmCommandResult & {
  /** All locally installed Node.js versions. */
  versions: InstalledNodeVersion[];
};

/**
 * A single nvm alias (e.g. `default`, `stable`, `lts/jod`, or a custom name)
 * as parsed from `nvm alias`.
 */
export type NvmAlias = {
  /** Alias name, e.g. `"default"`, `"stable"`, `"lts/jod"`, or a user-defined name. */
  name: string;
  /** Raw alias target as configured, e.g. a version number or another alias. */
  target: string;
  /**
   * The concrete version the alias ultimately resolves to (e.g. `"v22.11.0"`),
   * or `null` if it cannot be resolved (e.g. points to an uninstalled version).
   */
  resolved: string | null;
  /** `true` if the UI should allow changing this alias's target. */
  editable: boolean;
  /** `true` if the UI should allow deleting this alias (built-ins are typically not deletable). */
  deletable: boolean;
};

/** Response for the aliases endpoint: command output plus the parsed alias list. */
export type AliasesResponse = NvmCommandResult & {
  /** All configured nvm aliases. */
  aliases: NvmAlias[];
};

/**
 * The kind of nvm operation a progress modal represents. Determines both the
 * modal's wording and which error-classification branch is used.
 *
 * - `install`    – installing a new version
 * - `use`        – activating a version (persisted via the `default` alias)
 * - `uninstall`  – removing a version
 * - `nvm-update` – updating nvm itself
 * - `default`    – editing the `default` alias specifically
 * - `alias`      – editing any other alias (custom, `stable`, `lts/*`)
 */
export type InstallModalAction = 'install' | 'use' | 'uninstall' | 'nvm-update' | 'default' | 'alias';

/**
 * State of the shared install/progress modal.
 *
 * `null` means the modal is hidden. A non-null value describes the in-flight or
 * completed operation; the `phase` drives whether the modal shows a spinner,
 * a success message (auto-closing), or an error with recovery instructions.
 */
export type InstallModalState = {
  /** Which operation the modal is reporting on. */
  action: InstallModalAction;
  /** Current stage of the operation. */
  phase: 'running' | 'success' | 'error';
  /** The version string the operation targets, shown in the modal text. */
  version: string;
  /** Name of the alias being edited (only used for the 'alias' action). */
  alias?: string;
  /** Raw error message from the backend, present only in the `'error'` phase. */
  errorMessage?: string;
} | null;

/**
 * A log message emitted by a component to be appended to the central activity log.
 * Carries no timestamp; the state service adds one when storing it (see {@link LogEntry}).
 */
export type LogEvent = {
  /** Human-readable message text (user-facing, German). */
  message: string;
  /** Severity, controlling the entry's visual styling in the log panel. */
  type: 'success' | 'error' | 'info';
};

/**
 * A stored activity-log entry: a {@link LogEvent} enriched with the time it was recorded.
 */
export type LogEntry = LogEvent & {
  /** Moment the entry was added to the log, used for display ordering and formatting. */
  timestamp: Date;
};
