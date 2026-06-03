export type InstalledNodeVersion = {
  version: string;
  active: boolean;
  default: boolean;
  system: boolean;
  /** true if the "stable" alias points to this version. */
  stable: boolean;
  /** true if the "unstable" alias points to this version. */
  unstable: boolean;
  /** true if the "iojs" alias points to this version. */
  iojs: boolean;
};

export type InstalledVersionsResponse = {
  stdout: string;
  stderr: string;
  versions: InstalledNodeVersion[];
};

export type NvmAlias = {
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

export type RemoteNodeVersion = {
  version: string;
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
 * Checks whether a version string is a safe nvm input value.
 * Allowed: node, stable, lts/*, or semver patterns (Major, Major.Minor, Major.Minor.Patch).
 * Prevents shell injection via strict whitelist regex.
 */
export function isValidVersionInput(v: unknown): v is string {
  return typeof v === 'string' && /^(node|stable|lts\/\*|\d+(\.\d+){0,2})$/.test(v);
}

/**
 * Checks whether an alias name is safe.
 * Allowed: letters, digits, hyphens, underscores. Must start with a letter.
 * "default" is included – can be set but not deleted.
 */
export function isValidAliasName(v: unknown): v is string {
  return typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(v);
}

/**
 * Checks whether an alias target is safe.
 * Allowed: node, stable, unstable, lts/<codename>, lts/*, vX.Y.Z, X, X.Y, X.Y.Z.
 */
export function isValidAliasTarget(v: unknown): v is string {
  return typeof v === 'string' && /^(node|stable|unstable|lts\/[\w.*-]+|v?\d+(\.\d+){0,2})$/.test(v);
}

/**
 * Checks whether an LTS codename is safe (the part after "lts/").
 * Allowed: letters, digits, hyphens, underscores, asterisks.
 * Examples: iron, hydrogen, *, lts-2024.
 */
export function isValidLtsCodename(v: unknown): v is string {
  return typeof v === 'string' && /^[\w*-]+$/.test(v) && v.length >= 1 && v.length <= 30;
}
