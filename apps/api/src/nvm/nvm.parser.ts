import type { NvmAlias, RemoteNodeVersion } from './nvm.types.js';

/**
 * Pure parsers that turn raw nvm stdout into structured objects.
 *
 * Kept free of side effects and I/O so they are trivially unit-testable
 * (see `nvm.parser.spec.ts`).
 */

/** Matches ANSI escape sequences (terminal colour codes) for stripping. */
const ANSI_ESCAPE = /\x1b\[[0-9;]*[a-zA-Z]/g;

/** Built-in aliases that nvm manages and that the UI must not allow deleting. */
const PROTECTED_ALIASES = new Set(['default', 'node', 'stable', 'unstable', 'iojs']);

/**
 * Parses the stdout output of `nvm alias` into structured alias objects.
 *
 * Each line has the format: `<name> -> <target> [(-> <resolved>)] [(default)]`.
 * Examples:
 *   - `default -> lts/* (-> v22.20.0)`
 *   - `node -> stable (-> v22.20.0) (default)`
 *   - `lts/iron -> v20.19.1 (-> N/A)`
 *   - `my-project -> v18.18.0`
 *
 * Lines without the ` -> ` separator are ignored. `resolved` falls back to the
 * target itself when the target is already a concrete `vX.Y.Z` version.
 *
 * @param stdout - Raw output of `nvm alias` (may contain ANSI colour codes).
 * @returns The parsed aliases, with `editable`/`deletable` flags derived from
 *          whether the alias is an LTS or protected built-in alias.
 */
export function parseAliases(stdout: string): NvmAlias[] {
  return stdout
    .split('\n')
    .map((line) => line.replace(ANSI_ESCAPE, '').trim())
    .filter((line) => line.includes(' -> '))
    .map((line): NvmAlias | null => {
      const arrowIdx = line.indexOf(' -> ');
      if (arrowIdx < 0) return null;

      const name = line.slice(0, arrowIdx).trim();
      const rest = line.slice(arrowIdx + 4);

      // The target is the first whitespace-delimited token after the arrow.
      const targetMatch = /^(\S+)/.exec(rest);
      const target = targetMatch?.[1] ?? '';

      // Prefer the explicit "(-> vX.Y.Z)" resolution; otherwise use the target
      // if it is itself a concrete version, else leave unresolved (null).
      const resolvedMatch = /\(->\s*(v\d+\.\d+\.\d+)/.exec(rest);
      const resolvedFromMatch = resolvedMatch ? resolvedMatch[1] : null;
      const resolved = resolvedFromMatch ?? (/^v\d+\.\d+\.\d+$/.test(target) ? target : null);

      const isLts = name.startsWith('lts/');

      return {
        name,
        target,
        resolved,
        // LTS aliases are managed via a dedicated file-based endpoint, not editable inline.
        editable: !isLts,
        deletable: !PROTECTED_ALIASES.has(name),
      };
    })
    .filter((a): a is NvmAlias => a !== null && a.name.length > 0);
}

/**
 * Parses the stdout output of `nvm ls-remote` into structured version objects.
 *
 * `nvm ls-remote` includes LTS codenames inline, e.g.:
 *   - `v24.15.0   (LTS: Krypton)`
 *   - `v24.16.0   (Latest LTS: Krypton)`
 *   - `v25.0.0`
 *
 * A single call is sufficient – no separate `--lts` call is needed. nvm prints
 * versions oldest-first, so the result is reversed to newest-first for the UI.
 * Lines without a recognisable version number are skipped.
 *
 * @param stdout - Raw output of `nvm ls-remote` (may contain ANSI colour codes).
 * @returns All available versions, newest first.
 */
export function parseRemoteVersions(stdout: string): RemoteNodeVersion[] {
  const versions: RemoteNodeVersion[] = [];

  for (const line of stdout.split('\n')) {
    const clean = line.replace(ANSI_ESCAPE, '');
    const versionMatch = /v(\d+\.\d+\.\d+)/.exec(clean);
    if (!versionMatch) continue;

    // Matches both "(LTS: Name)" and "(Latest LTS: Name)".
    const ltsMatch = /\((?:Latest\s+)?LTS:\s*([^)]+)\)/i.exec(clean);

    versions.push({
      version: versionMatch[1],
      lts: ltsMatch ? ltsMatch[1].trim() : null,
    });
  }

  // nvm lists ascending; the UI expects newest first.
  return versions.reverse();
}
