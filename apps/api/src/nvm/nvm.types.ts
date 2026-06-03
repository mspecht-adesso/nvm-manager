export type InstalledNodeVersion = {
  version: string;
  active: boolean;
  default: boolean;
  system: boolean;
};

export type InstalledVersionsResponse = {
  stdout: string;
  stderr: string;
  versions: InstalledNodeVersion[];
};

export type NvmAlias = {
  name: string;
  /** Direktes Ziel des Alias, z.B. "lts/*", "v22.11.0", "stable". */
  target: string;
  /** Aufgelöste Node-Version, falls bekannt, sonst null. */
  resolved: string | null;
  /** false für node/stable/unstable/lts/* – von nvm selbst verwaltet. */
  editable: boolean;
  /** false für default + alle eingebauten Aliases. */
  deletable: boolean;
};

export type AliasesResponse = {
  stdout: string;
  stderr: string;
  aliases: NvmAlias[];
};

export type RemoteNodeVersion = {
  version: string;
  lts: string | null;
};

export type RemoteVersionsResponse = {
  stdout: string;
  stderr: string;
  versions: RemoteNodeVersion[];
};

export type NvmStatus = {
  ok: boolean;
  nvmVersion?: string;
  nvmDir?: string;
  error?: string;
};

/**
 * Repräsentiert einen Fehler bei der Ausführung eines nvm-Kommandos.
 * Enthält stdout/stderr für Debugging im Error-Middleware.
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
 * Prüft, ob eine Version ein sicherer nvm-Eingabewert ist.
 * Erlaubt: node, stable, lts/*, oder Semver-Muster (Major, Major.Minor, Major.Minor.Patch).
 * Verhindert Shell-Injection durch striktes Whitelist-Regex.
 */
export function isValidVersionInput(v: unknown): v is string {
  return typeof v === 'string' && /^(node|stable|lts\/\*|\d+(\.\d+){0,2})$/.test(v);
}

/**
 * Prüft, ob ein Alias-Name sicher ist.
 * Erlaubt: Buchstaben, Ziffern, Bindestrich, Unterstrich. Muss mit Buchstaben beginnen.
 * "default" ist eingeschlossen – kann gesetzt, aber nicht gelöscht werden.
 */
export function isValidAliasName(v: unknown): v is string {
  return typeof v === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(v);
}

/**
 * Prüft, ob ein Alias-Ziel sicher ist.
 * Erlaubt: node, stable, unstable, lts/<codename>, lts/*, vX.Y.Z, X, X.Y, X.Y.Z.
 */
export function isValidAliasTarget(v: unknown): v is string {
  return typeof v === 'string' && /^(node|stable|unstable|lts\/[\w.*-]+|v?\d+(\.\d+){0,2})$/.test(v);
}

/**
 * Prüft, ob ein LTS-Codename sicher ist (der Teil nach "lts/").
 * Erlaubt: Buchstaben, Ziffern, Bindestrich, Unterstrich, Sternchen.
 * Beispiele: iron, hydrogen, *, lts-2024.
 */
export function isValidLtsCodename(v: unknown): v is string {
  return typeof v === 'string' && /^[\w*-]+$/.test(v) && v.length >= 1 && v.length <= 30;
}
