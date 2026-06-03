import type { InstalledNodeVersion, NvmAlias, RemoteNodeVersion } from './nvm.types.js';

// Entfernt ANSI-Escape-Sequenzen (Farbcodes) aus einem String.
const ANSI_ESCAPE = /\x1b\[[0-9;]*[a-zA-Z]/g;

/**
 * Parst die stdout-Ausgabe von `nvm ls` in strukturierte Versionsobjekte.
 *
 * Installierte Versionen stehen immer am Zeilenanfang (ggf. mit führenden
 * Leerzeichen und optionalem `->` für die aktive Version):
 *   ->     v22.11.0 (default)
 *          v20.18.0
 *          v18.20.7
 *
 * Alias-/Zusammenfassungszeilen wie
 *   default -> v22.11.0 (-> v22.11.0)
 *   node -> stable (-> v22.11.0)
 *   lts/iron -> v20.19.1 (-> N/A)
 * werden bewusst ignoriert.
 */
/**
 * Parst die stdout-Ausgabe von `nvm alias` in strukturierte Alias-Objekte.
 *
 * Format jeder Zeile: <name> -> <target> [(-> <resolved>)] [(default)]
 * Beispiele:
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
 * Parst die stdout-Ausgabe von `nvm ls-remote` in strukturierte Versionsobjekte.
 *
 * `nvm ls-remote` liefert LTS-Codenames inline, z.B.:
 *   v24.15.0   (LTS: Krypton)
 *   v24.16.0   (Latest LTS: Krypton)
 *   v25.0.0
 *
 * Ein einzelner Call reicht – kein separater `--lts`-Aufruf nötig.
 * Liefert alle Versionen in absteigender Reihenfolge (neueste zuerst).
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

export function parseInstalledVersions(stdout: string): InstalledNodeVersion[] {
  return stdout
    .split('\n')
    .map((line) => line.replace(ANSI_ESCAPE, ''))
    // Nur echte Versionszeilen: optional Whitespace, optional "->", Whitespace, dann "vX.Y.Z"
    .filter((line) => /^\s*(->)?\s*v\d+\.\d+\.\d+/.test(line))
    .map((line) => ({
      version: (/v(\d+\.\d+\.\d+)/.exec(line) ?? [])[1] ?? '',
      active: line.trim().startsWith('->'),
      default: line.includes('(default)'),
      system: line.includes('system'),
    }))
    .filter((v) => v.version !== '');
}
