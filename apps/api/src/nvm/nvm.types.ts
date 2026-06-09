/**
 * Type definitions and input validators for the nvm backend.
 *
 * The validators here form the first of the two shell-injection defence layers
 * (whitelist regexes applied before any nvm call); the second layer is the
 * single-quote escaping performed in `nvm.service.ts`. See the `nvm-security` rule.
 */

/**
 * A single locally installed Node.js version with its nvm-assigned flags.
 * Mirrors the frontend's `InstalledNodeVersion`; the flags are not mutually
 * exclusive (e.g. a version can be both `active` and `default`).
 */
export type InstalledNodeVersion = {
  /** Version number without a leading `v`, e.g. `"22.11.0"`. */
  version: string;
  /** true if this version is the one currently active in the server's PATH/override. */
  active: boolean;
  /** true if this version is the target of the "default" alias. */
  default: boolean;
  /** true for the system-provided Node.js (outside nvm's control). */
  system: boolean;
  /** true if the "stable" alias points to this version. */
  stable: boolean;
  /** true if the "unstable" alias points to this version. */
  unstable: boolean;
  /** true if the "iojs" alias points to this version. */
  iojs: boolean;
};

/** Response shape for the installed-versions endpoint: raw output plus parsed list. */
export type InstalledVersionsResponse = {
  /** Raw stdout (empty for the fast filesystem-based path). */
  stdout: string;
  /** Raw stderr. */
  stderr: string;
  /** The parsed list of installed versions. */
  versions: InstalledNodeVersion[];
};

/** A single nvm alias as parsed from `nvm alias`. */
export type NvmAlias = {
  /** Alias name, e.g. "default", "lts/iron", or a custom name. */
  name: string;
  /** Direct target of the alias, e.g. "lts/*", "v22.11.0", "stable". */
  target: string;
  /** Resolved Node.js version if known, otherwise null. */
  resolved: string | null;
  /** false for node/stable/unstable/lts/* – managed by nvm itself. */
  editable: boolean;
  /** false for default and all built-in aliases. */
  deletable: boolean;
};

/** A single Node.js version available from the nvm remote index. */
export type RemoteNodeVersion = {
  /** Version number without a leading `v`, e.g. `"22.11.0"`. */
  version: string;
  /** LTS codename (e.g. "Jod") or null for non-LTS releases. */
  lts: string | null;
};

/**
 * Represents an error that occurred during execution of an nvm command.
 * Contains stdout/stderr for debugging in the error middleware.
 */
export class NvmError extends Error {
  constructor(
    message: string,
    public readonly stdout: string,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'NvmError';
  }
}

/**
 * Type guard: checks whether a version string is a safe nvm input value.
 *
 * Allowed: `node`, `stable`, `lts/*`, or semver patterns (Major, Major.Minor,
 * Major.Minor.Patch). The strict whitelist regex prevents shell injection –
 * anything outside this set (paths, shell metacharacters, command substitution)
 * is rejected.
 *
 * @param v - Untrusted value, typically from `req.body`/`req.query`.
 * @returns `true` (narrowing to `string`) only for accepted version inputs.
 */
export function isValidVersionInput(v: unknown): v is string {
  return typeof v === 'string' && /^(node|stable|lts\/\*|\d+(\.\d+){0,2})$/.test(v);
}

/**
 * Type guard: checks whether an alias name is safe.
 *
 * Allowed: letters, digits, hyphens, underscores; must start with a letter and
 * be at most 50 characters. `default` is accepted here (it may be *set*) but is
 * blocked from deletion separately in the route layer.
 *
 * @param v - Untrusted value.
 * @returns `true` (narrowing to `string`) only for accepted alias names.
 */
export function isValidAliasName(v: unknown): v is string {
  return typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(v);
}

/**
 * Type guard: checks whether an alias target is safe.
 *
 * Allowed: `node`, `stable`, `unstable`, `lts/<codename>`, `lts/*`, `vX.Y.Z`,
 * and bare semver (`X`, `X.Y`, `X.Y.Z`).
 *
 * @param v - Untrusted value.
 * @returns `true` (narrowing to `string`) only for accepted alias targets.
 */
export function isValidAliasTarget(v: unknown): v is string {
  return typeof v === 'string' && /^(node|stable|unstable|lts\/[\w.*-]+|v?\d+(\.\d+){0,2})$/.test(v);
}

/**
 * Type guard: checks whether an LTS codename is safe (the part after `lts/`).
 *
 * Allowed: letters, digits, hyphens, underscores, asterisks; length 1–30.
 * Examples: `iron`, `hydrogen`, `*`, `lts-2024`. This is critical because the
 * codename is used as a filename under `~/.nvm/alias/lts/`, so path traversal
 * characters (`/`, `..`, spaces) must be rejected.
 *
 * @param v - Untrusted value.
 * @returns `true` (narrowing to `string`) only for accepted codenames.
 */
export function isValidLtsCodename(v: unknown): v is string {
  return typeof v === 'string' && /^[\w*-]+$/.test(v) && v.length >= 1 && v.length <= 30;
}
