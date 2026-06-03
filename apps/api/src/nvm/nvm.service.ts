import { execFile, spawn } from 'node:child_process';
import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { NvmError } from './nvm.types.js';
import type { InstalledNodeVersion, InstalledVersionsResponse } from './nvm.types.js';

const NVM_DIR = process.env['NVM_DIR'] ?? `${process.env['HOME']}/.nvm`;

/**
 * Shared shell header: sets NVM_DIR and sources nvm.sh.
 * Arguments are single-quote-escaped to prevent shell injection.
 *
 * No "-l" (login shell): all required variables are set manually here.
 * A login shell would load .bash_profile, oh-my-zsh, etc. and delay
 * every call by several seconds.
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
 * Executes a single nvm command and returns stdout/stderr.
 * Timeout: 3 minutes (to accommodate nvm install).
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
 * Reads an alias file from the NVM alias directory.
 * Returns null if the file does not exist.
 */
async function readAliasFile(...segments: string[]): Promise<string | null> {
  try {
    return (await readFile(path.join(NVM_DIR, 'alias', ...segments), 'utf-8')).trim();
  } catch {
    return null;
  }
}

/**
 * Normalizes a version string to the "vX.Y.Z" format.
 * Accepts both "v22.14.0" and "22.14.0".
 */
function normalizeVersion(v: string): string | null {
  const m = /^v?(\d+\.\d+\.\d+)$/.exec(v);
  return m ? `v${m[1]}` : null;
}

/**
 * Recursively resolves an alias value to a concrete version.
 * Supports chains: default → lts/* → v22.11.0
 * Accepts versions with or without the "v" prefix.
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
 * Reads installed versions directly from the filesystem (~/.nvm/).
 *
 * Much faster than `nvm ls` because no shell process is spawned.
 * Reads:
 *   ~/.nvm/versions/node/ – list of installed versions
 *   ~/.nvm/alias/default  – default alias chain → resolved version
 *
 * The active version is determined from the PATH of the running Node.js process
 * (fast, no subprocess needed).
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

  // Resolve all relevant aliases in parallel
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

  // Active version: determined from the PATH of the running Node.js process
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
 * Spawns an nvm command as a streaming child process for SSE.
 * Used for `nvm install` to deliver live output.
 */
export function spawnNvm(args: string[]): ChildProcess {
  const cmd = NVM_HEADER + `nvm ${escapeArgs(args)}`;
  return spawn('bash', ['-c', cmd]);
}

/**
 * Writes an LTS alias directly as a file to ~/.nvm/alias/lts/<codename>.
 *
 * `nvm alias lts/<codename> <version>` fails ("Aliases in subdirectories
 * are not supported") because nvm manages LTS aliases internally as files in a
 * subdirectory. Direct file access is the mechanism nvm itself uses.
 */
export async function setLtsAliasFile(codename: string, version: string): Promise<void> {
  const ltsDir = path.join(NVM_DIR, 'alias', 'lts');
  await mkdir(ltsDir, { recursive: true });
  const normalized = version.startsWith('v') ? version : `v${version}`;
  await writeFile(path.join(ltsDir, codename), `${normalized}\n`, 'utf-8');
}

/**
 * Deletes an LTS alias file directly from ~/.nvm/alias/lts/<codename>.
 *
 * `nvm unalias lts/<codename>` fails for the same reason as `nvm alias`.
 */
export async function deleteLtsAliasFile(codename: string): Promise<void> {
  await unlink(path.join(NVM_DIR, 'alias', 'lts', codename));
}

/**
 * Updates nvm to the latest available version.
 *
 * Method: git fetch + git checkout inside the NVM_DIR directory.
 * `nvm upgrade` is not a stable, cross-version nvm command –
 * the git approach is the official, reliable upgrade method per nvm documentation.
 *
 * 1. Calls fetchNvmLatestVersion() to determine the target version.
 * 2. Runs `git fetch --tags origin` inside NVM_DIR.
 * 3. Checks out the target version via `git checkout`.
 * Timeout: 3 minutes.
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
 * Opens the NVM_DIR directory in the native file manager.
 * Uses `open` on macOS and `xdg-open` on Linux.
 * The path comes exclusively from the server environment (no user input).
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
 * Fetches the latest nvm version from the GitHub Releases API.
 * Timeout: 5 seconds. Returns `null` if the request fails.
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
