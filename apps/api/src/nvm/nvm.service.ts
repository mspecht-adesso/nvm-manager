import { execFile, spawn } from 'node:child_process';
import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { NvmError } from './nvm.types.js';
import type { InstalledNodeVersion, InstalledVersionsResponse } from './nvm.types.js';

/**
 * nvm execution layer.
 *
 * nvm is a shell function, not a binary, so most operations run inside a
 * `bash -c` subshell that first sources `nvm.sh` (see {@link NVM_HEADER}).
 * Where possible the service reads `~/.nvm` directly from the filesystem
 * (see {@link runNvmLsFast}) to avoid the cost of spawning a shell.
 *
 * Shell-injection defence is two-layered: route-level whitelist validation
 * (`nvm.types.ts`) plus single-quote escaping here (see {@link escapeArgs}).
 */

/** Resolved nvm installation directory, from `NVM_DIR` or the default `~/.nvm`. */
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

/**
 * Single-quote-escapes each argument and joins them for safe shell use.
 * Each arg is wrapped in single quotes, and any embedded single quote is
 * turned into the `'\''` sequence so it cannot terminate the quoting.
 *
 * @param args - Raw nvm arguments (already whitelist-validated upstream).
 * @returns A space-joined, shell-safe argument string.
 */
function escapeArgs(args: string[]): string {
  return args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
}

/**
 * In-memory override for the currently active Node.js version.
 *
 * The server process determines the "active" version from its own PATH
 * (see runNvmLsFast). That PATH never changes at runtime, so a `nvm use`
 * triggered through the UI would otherwise never be reflected in the
 * installed-versions response. This override stores the version the user
 * last switched to so the active marker (and thus the header) updates.
 *
 * Stores the raw user input (e.g. "22", "22.14.0", "lts/*"); it is resolved
 * to a concrete installed version directory on each read in runNvmLsFast.
 */
let activeVersionOverride: string | null = null;

/**
 * Records the version the user just switched to via `nvm use` so that
 * subsequent calls to {@link runNvmLsFast} reflect the change.
 *
 * @param version - The raw version string used in the `nvm use` call, or `null`
 *                  to clear the override and fall back to PATH-based detection.
 */
export function setActiveVersionOverride(version: string | null): void {
  activeVersionOverride = version;
}

/**
 * Resolves a (possibly partial) version input to a concrete installed version
 * directory name (`vX.Y.Z`).
 *
 * - Numeric inputs (`"22"`, `"22.14"`, `"v22.14.0"`) are matched on version-segment
 *   boundaries; the highest matching installed version wins.
 * - Alias keywords (`node`, `stable`, `unstable`, `iojs`, `default`, `lts/…`) are
 *   resolved recursively via the alias files.
 *
 * @param input       - Whitelist-validated user-supplied version or alias value.
 * @param versionDirs - Sorted ascending list of installed version directory names
 *                      (e.g. `["v20.5.0", "v22.11.0"]`).
 * @returns The matching directory name (e.g. `"v22.11.0"`), or `null` if nothing matches.
 */
async function resolveVersionToDir(input: string, versionDirs: string[]): Promise<string | null> {
  const numeric = /^v?(\d+(?:\.\d+){0,2})$/.exec(input);
  if (numeric) {
    const inputSegs = numeric[1].split('.');
    let match: string | null = null;
    for (const dir of versionDirs) {
      const dirSegs = dir.slice(1).split('.');
      if (inputSegs.every((seg, i) => seg === dirSegs[i])) {
        match = dir; // keep the highest match (versionDirs is ascending)
      }
    }
    return match;
  }

  const aliasValue = input === 'default' ? await readAliasFile('default') : input;
  if (!aliasValue) return null;
  const resolved = await resolveAlias(aliasValue);
  return resolved && versionDirs.includes(resolved) ? resolved : null;
}

/**
 * Executes a single nvm command in a `bash -c` subshell and returns its output.
 *
 * The command is built from {@link NVM_HEADER} plus the escaped arguments.
 * Timeout is 3 minutes (to accommodate `nvm install`) and `maxBuffer` is 10 MB
 * (to accommodate the large `ls-remote` output).
 *
 * @param args - Whitelist-validated nvm arguments (e.g. `['install', '22']`).
 * @returns The command's stdout and stderr.
 * @throws {NvmError} when nvm exits with a non-zero code, carrying stdout/stderr.
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
 * Reads an alias file from the nvm alias directory (`~/.nvm/alias/…`).
 *
 * @param segments - Path segments appended to `$NVM_DIR/alias/` (e.g. `'default'`
 *                   or `'lts', 'iron'`).
 * @returns The trimmed file content, or `null` if the file does not exist.
 */
async function readAliasFile(...segments: string[]): Promise<string | null> {
  try {
    return (await readFile(path.join(NVM_DIR, 'alias', ...segments), 'utf-8')).trim();
  } catch {
    return null;
  }
}

/**
 * Normalises a version string to the `vX.Y.Z` format.
 * Accepts both `"v22.14.0"` and `"22.14.0"`.
 *
 * @param v - Raw version string.
 * @returns The normalised `vX.Y.Z` string, or `null` if it is not a concrete version.
 */
function normalizeVersion(v: string): string | null {
  const m = /^v?(\d+\.\d+\.\d+)$/.exec(v);
  return m ? `v${m[1]}` : null;
}

/**
 * Recursively resolves an alias value to a concrete `vX.Y.Z` version.
 *
 * Supports chains (e.g. `default → lts/* → v22.11.0`). Accepts versions with
 * or without a leading `v`. The recursion depth is capped at 5 to protect
 * against circular alias chains (e.g. `default → loop → loop → …`).
 *
 * @param value - Alias value to resolve (e.g. `"lts/iron"`, `"stable"`, `"v22.11.0"`).
 * @param depth - Current recursion depth (internal; starts at 0).
 * @returns The resolved `vX.Y.Z` string, or `null` if unresolvable.
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
 * Reads installed Node.js versions directly from the filesystem without spawning
 * a shell process.
 *
 * Reads from:
 *   - `$NVM_DIR/versions/node/` – installed version directories (e.g. `v22.11.0`)
 *   - `$NVM_DIR/alias/default`, `stable`, `unstable`, `iojs` – alias files
 *
 * The active version is determined from the PATH of the running process.
 * If the user switched versions via the UI, {@link activeVersionOverride} takes
 * precedence over PATH-based detection.
 *
 * @returns Structured response with all installed versions and their flags.
 *          `stdout` and `stderr` are empty strings (no subprocess output).
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

  // Active version: by default determined from the PATH of the running
  // Node.js process. If the user switched versions through the UI, the
  // override takes precedence so the active marker reflects that choice.
  const pathEnv = process.env['PATH'] ?? '';
  const activeMatch = /\.nvm\/versions\/node\/(v[\d.]+)\/bin/.exec(pathEnv);
  let activeVersion = activeMatch?.[1] ?? null;

  if (activeVersionOverride) {
    const resolved = await resolveVersionToDir(activeVersionOverride, versionDirs);
    if (resolved) {
      activeVersion = resolved;
    } else {
      // Override no longer matches an installed version (e.g. uninstalled).
      activeVersionOverride = null;
    }
  }

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
 * Spawns an nvm command as a streaming child process (for Server-Sent Events).
 * Unlike {@link runNvm}, the caller consumes stdout/stderr incrementally,
 * which is used by the install-stream endpoint to deliver live progress.
 *
 * @param args - Whitelist-validated nvm arguments.
 * @returns The spawned child process; the caller must wire up its streams.
 */
export function spawnNvm(args: string[]): ChildProcess {
  const cmd = NVM_HEADER + `nvm ${escapeArgs(args)}`;
  return spawn('bash', ['-c', cmd]);
}

/**
 * Writes an LTS alias directly as a file to `~/.nvm/alias/lts/<codename>`.
 *
 * `nvm alias lts/<codename> <version>` fails ("Aliases in subdirectories
 * are not supported") because nvm manages LTS aliases internally as files in a
 * subdirectory. Direct file access is the mechanism nvm itself uses.
 * The version is normalised to include a leading `v`.
 *
 * @param codename - LTS codename (already validated; used as the filename).
 * @param version  - Target version, with or without a leading `v`.
 */
export async function setLtsAliasFile(codename: string, version: string): Promise<void> {
  const ltsDir = path.join(NVM_DIR, 'alias', 'lts');
  await mkdir(ltsDir, { recursive: true });
  const normalized = version.startsWith('v') ? version : `v${version}`;
  await writeFile(path.join(ltsDir, codename), `${normalized}\n`, 'utf-8');
}

/**
 * Deletes an LTS alias file directly from `~/.nvm/alias/lts/<codename>`.
 *
 * `nvm unalias lts/<codename>` fails for the same reason as `nvm alias`.
 *
 * @param codename - LTS codename (already validated; used as the filename).
 * @throws when the file does not exist or cannot be removed (propagated to the caller).
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
 *
 * @returns stdout/stderr of the git operation (stdout falls back to a success message).
 * @throws {NvmError} if the latest version cannot be determined, the API returns
 *         a non-semver tag (injection guard), or the git command fails.
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
  // Defense-in-depth: the version comes from the GitHub API and is interpolated
  // into a shell command. Reject anything that is not a plain semver tag so a
  // malicious/garbled API response can never break out of the quoting.
  if (!/^v\d+\.\d+\.\d+$/.test(version)) {
    throw new NvmError(`Ungültiges nvm-Versionsformat von der GitHub-API: ${version}`, '', '');
  }
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
 *
 * @returns Resolves once the file manager has been launched.
 * @throws {Error} if the launch command fails.
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
 * Fetches the latest nvm release tag from the GitHub Releases API.
 *
 * Timeout: 5 seconds via `AbortSignal.timeout`. Returns `null` instead of
 * throwing so that a GitHub outage only degrades the "update available" banner
 * rather than breaking the status endpoint entirely.
 *
 * @returns The version string without a leading `v` (e.g. `"0.40.4"`), or `null`
 *          if the request fails or the response does not contain a valid tag.
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
