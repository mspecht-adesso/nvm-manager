import type { NvmAlias, RemoteNodeVersion } from './nvm.types.js';

// Strips ANSI escape sequences (color codes) from a string.
const ANSI_ESCAPE = /\x1b\[[0-9;]*[a-zA-Z]/g;

/**
 * Parses the stdout output of `nvm alias` into structured alias objects.
 *
 * Each line format: <name> -> <target> [(-> <resolved>)] [(default)]
 * Examples:
 *   default -> lts/* (-> v22.20.0)
 *   node -> stable (-> v22.20.0) (default)
 *   lts/iron -> v20.19.1 (-> N/A)
 *   my-project -> v18.18.0
 */
const PROTECTED_ALIASES = new Set(['default', 'node', 'stable', 'unstable', 'iojs']);

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

      const targetMatch = /^(\S+)/.exec(rest);
      const target = targetMatch?.[1] ?? '';

      const resolvedMatch = /\(->\s*(v\d+\.\d+\.\d+)/.exec(rest);
      const resolvedFromMatch = resolvedMatch ? resolvedMatch[1] : null;
      const resolved = resolvedFromMatch ?? (/^v\d+\.\d+\.\d+$/.test(target) ? target : null);

      const isLts = name.startsWith('lts/');

      return {
        name,
        target,
        resolved,
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
 *   v24.15.0   (LTS: Krypton)
 *   v24.16.0   (Latest LTS: Krypton)
 *   v25.0.0
 *
 * A single call is sufficient – no separate `--lts` call needed.
 * Returns all versions in descending order (newest first).
 */
export function parseRemoteVersions(stdout: string): RemoteNodeVersion[] {
  const versions: RemoteNodeVersion[] = [];

  for (const line of stdout.split('\n')) {
    const clean = line.replace(ANSI_ESCAPE, '');
    const versionMatch = /v(\d+\.\d+\.\d+)/.exec(clean);
    if (!versionMatch) continue;

    const ltsMatch = /\((?:Latest\s+)?LTS:\s*([^)]+)\)/i.exec(clean);

    versions.push({
      version: versionMatch[1],
      lts: ltsMatch ? ltsMatch[1].trim() : null,
    });
  }

  return versions.reverse();
}
