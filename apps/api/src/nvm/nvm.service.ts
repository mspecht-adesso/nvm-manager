import { execFile, spawn } from 'node:child_process';
import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { NvmError } from './nvm.types.js';
import type { InstalledNodeVersion, InstalledVersionsResponse } from './nvm.types.js';

const NVM_DIR = process.env['NVM_DIR'] ?? `${process.env['HOME']}/.nvm`;

/**
 * Gemeinsamer Shell-Header: setzt NVM_DIR und lädt nvm.sh.
 * Argumente werden single-quote-escaped, um Shell-Injection zu verhindern.
 *
 * Kein "-l" (Login-Shell): alle nötigen Variablen werden hier manuell
 * gesetzt. Login-Shell würde .bash_profile, oh-my-zsh usw. laden und
 * jeden Aufruf um mehrere Sekunden verzögern.
 */
const NVM_HEADER = `
  unset npm_config_prefix;
  unset NPM_CONFIG_PREFIX;
  export NVM_DIR="${NVM_DIR}";
  export HOME="${process.env['HOME'] ?? ''}";
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";
`;

function escapeArgs(args: string[]): string {
  return args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
}

/**
 * Führt ein einzelnes nvm-Kommando aus und gibt stdout/stderr zurück.
 * Timeout: 3 Minuten (für nvm install).
 */
export function runNvm(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const cmd = NVM_HEADER + `nvm ${escapeArgs(args)}`;

  return new Promise((resolve, reject) => {
    execFile(
      'bash',
      ['-c', cmd],
      { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new NvmError(error.message, stdout, stderr));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

/**
 * Liest eine Alias-Datei aus dem NVM-Alias-Verzeichnis.
 * Gibt null zurück wenn die Datei nicht existiert.
 */
async function readAliasFile(...segments: string[]): Promise<string | null> {
  try {
    return (await readFile(path.join(NVM_DIR, 'alias', ...segments), 'utf-8')).trim();
  } catch {
    return null;
  }
}

/**
 * Normalisiert einen Versionsstring auf das Format "vX.Y.Z".
 * Akzeptiert sowohl "v22.14.0" als auch "22.14.0".
 */
function normalizeVersion(v: string): string | null {
  const m = /^v?(\d+\.\d+\.\d+)$/.exec(v);
  return m ? `v${m[1]}` : null;
}

/**
 * Löst einen Alias-Wert rekursiv zu einer konkreten Version auf.
 * Unterstützt Ketten: default → lts/* → v22.11.0
 * Akzeptiert Version mit oder ohne "v"-Prefix.
 */
async function resolveAlias(value: string, depth = 0): Promise<string | null> {
  if (depth > 5) return null;
  const normalized = normalizeVersion(value);
  if (normalized) return normalized;

  if (value.startsWith('lts/')) {
    const codename = value.slice(4);
    const ltsValue = await readAliasFile('lts', codename);
    return ltsValue ? resolveAlias(ltsValue, depth + 1) : null;
  }

  const aliasValue = await readAliasFile(value);
  return aliasValue ? resolveAlias(aliasValue, depth + 1) : null;
}

/**
 * Ermittelt die installierte Versionen direkt aus dem Dateisystem (~/.nvm/).
 *
 * Wesentlich schneller als `nvm ls`, weil kein Shell-Prozess gestartet wird.
 * Liest:
 *   ~/.nvm/versions/node/ – Liste installierter Versionen
 *   ~/.nvm/alias/default  – Default-Alias-Kette → aufgelöste Version
 *
 * Die aktive Version wird aus dem PATH des Node.js-Prozesses ermittelt
 * (schnell, kein Subprozess nötig).
 */
export async function runNvmLsFast(): Promise<InstalledVersionsResponse> {
  const versionsDir = path.join(NVM_DIR, 'versions', 'node');

  let versionDirs: string[] = [];
  try {
    versionDirs = (await readdir(versionsDir)).filter((d) => /^v\d+/.test(d)).sort((a, b) => {
      const pa = a.slice(1).split('.').map(Number);
      const pb = b.slice(1).split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
      }
      return 0;
    });
  } catch {
    versionDirs = [];
  }

  // Alle relevanten Aliases parallel auflösen
  const [defaultAlias, stableAlias, unstableAlias, iojsAlias] = await Promise.all([
    readAliasFile('default'),
    readAliasFile('stable'),
    readAliasFile('unstable'),
    readAliasFile('iojs'),
  ]);

  const [defaultVersion, stableVersion, unstableVersion, iojsVersion] = await Promise.all([
    defaultAlias ? resolveAlias(defaultAlias) : null,
    stableAlias ? resolveAlias(stableAlias) : null,
    unstableAlias ? resolveAlias(unstableAlias) : null,
    iojsAlias ? resolveAlias(iojsAlias) : null,
  ]);

  // Aktive Version: aus PATH des laufenden Node.js-Prozesses ermitteln
  const pathEnv = process.env['PATH'] ?? '';
  const activeMatch = /\.nvm\/versions\/node\/(v[\d.]+)\/bin/.exec(pathEnv);
  const activeVersion = activeMatch?.[1] ?? null;

  const versions: InstalledNodeVersion[] = versionDirs.map((dir) => ({
    version: dir.slice(1),
    active: dir === activeVersion,
    default: dir === defaultVersion,
    stable: stableVersion !== null && dir === stableVersion,
    unstable: unstableVersion !== null && dir === unstableVersion,
    iojs: iojsVersion !== null && dir === iojsVersion,
    system: false,
  }));

  return { stdout: '', stderr: '', versions };
}

/**
 * Startet ein nvm-Kommando als Streaming-Child-Process für SSE.
 * Wird für `nvm install` verwendet, um Live-Output zu liefern.
 */
export function spawnNvm(args: string[]): ChildProcess {
  const cmd = NVM_HEADER + `nvm ${escapeArgs(args)}`;
  return spawn('bash', ['-c', cmd]);
}

/**
 * Setzt einen LTS-Alias direkt als Datei in ~/.nvm/alias/lts/<codename>.
 *
 * `nvm alias lts/<codename> <version>` schlägt fehl ("Aliases in subdirectories
 * are not supported"), weil nvm lts-Aliases intern als Dateien im Unterverzeichnis
 * verwaltet. Der direkte Dateizugriff ist der von nvm verwendete Mechanismus.
 */
export async function setLtsAliasFile(codename: string, version: string): Promise<void> {
  const ltsDir = path.join(NVM_DIR, 'alias', 'lts');
  await mkdir(ltsDir, { recursive: true });
  const normalized = version.startsWith('v') ? version : `v${version}`;
  await writeFile(path.join(ltsDir, codename), `${normalized}\n`, 'utf-8');
}

/**
 * Löscht einen LTS-Alias-Datei direkt aus ~/.nvm/alias/lts/<codename>.
 *
 * `nvm unalias lts/<codename>` schlägt aus demselben Grund fehl wie `nvm alias`.
 */
export async function deleteLtsAliasFile(codename: string): Promise<void> {
  await unlink(path.join(NVM_DIR, 'alias', 'lts', codename));
}

/**
 * Aktualisiert nvm auf die neueste verfügbare Version.
 *
 * Methode: git fetch + git checkout im NVM_DIR-Verzeichnis.
 * `nvm upgrade` ist kein stabiles, versionsübergreifendes nvm-Kommando –
 * der git-Weg ist die offizielle, zuverlässige Upgrade-Methode laut nvm-Dokumentation.
 *
 * 1. Ruft fetchNvmLatestVersion() auf, um die Zielversion zu ermitteln.
 * 2. Führt `git fetch --tags origin` im NVM_DIR aus.
 * 3. Checkt die Zielversion via `git checkout` aus.
 * Timeout: 3 Minuten.
 */
export async function updateNvm(): Promise<{ stdout: string; stderr: string }> {
  const nvmDir = process.env['NVM_DIR'] ?? `${process.env['HOME']}/.nvm`;

  const latestVersion = await fetchNvmLatestVersion();
  if (!latestVersion) {
    throw new NvmError(
      'Konnte die neueste nvm-Version nicht ermitteln. Prüfe die Internetverbindung.',
      '',
      '',
    );
  }

  const version = `v${latestVersion.replace(/^v/, '')}`;
  const safeDir = nvmDir.replace(/'/g, "'\\''");
  const cmd = `set -e; cd '${safeDir}'; git fetch --tags origin; git checkout '${version}'`;

  return new Promise((resolve, reject) => {
    execFile(
      'bash',
      ['-c', cmd],
      { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new NvmError(error.message, stdout, stderr));
          return;
        }
        resolve({ stdout: stdout || `nvm erfolgreich auf ${version} aktualisiert.`, stderr });
      },
    );
  });
}

/**
 * Öffnet das NVM_DIR-Verzeichnis im nativen Dateimanager.
 * Verwendet `open` auf macOS und `xdg-open` auf Linux.
 * Der Pfad kommt ausschließlich aus der Server-Umgebung (kein User-Input).
 */
export function openNvmDir(): Promise<void> {
  const nvmDir = process.env['NVM_DIR'] ?? `${process.env['HOME']}/.nvm`;
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';

  return new Promise((resolve, reject) => {
    execFile(cmd, [nvmDir], { timeout: 10_000 }, (error) => {
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

/**
 * Fragt die neueste nvm-Version von der GitHub-Releases-API ab.
 * Timeout: 5 Sekunden. Gibt `null` zurück wenn die Abfrage fehlschlägt.
 */
export async function fetchNvmLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/repos/nvm-sh/nvm/releases/latest', {
      headers: { 'User-Agent': 'nvm-manager/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { tag_name?: string };
    return data.tag_name?.replace(/^v/, '') ?? null;
  } catch {
    return null;
  }
}
