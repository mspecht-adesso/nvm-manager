/**
 * Unit tests for `nvm.service.ts`.
 *
 * All I/O is mocked at the module boundary:
 *   - `node:child_process` – `execFile` and `spawn` are replaced with `vi.mock`
 *     so no real shell process is ever spawned.
 *   - `node:fs/promises` – `readdir`, `readFile`, `writeFile`, `unlink`, `mkdir`
 *     are mocked to control the virtual `~/.nvm` filesystem.
 *   - `globalThis.fetch` – stubbed with `vi.stubGlobal` for GitHub API tests.
 *
 * The `mockExecFile` helper drives `execFile` callbacks synchronously so tests
 * do not need timers; `vi.resetAllMocks()` in `beforeEach` ensures test isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NvmError } from './nvm.types.js';

vi.mock('node:child_process');
vi.mock('node:fs/promises');

import * as childProcess from 'node:child_process';
import * as fs from 'node:fs/promises';
import {
  runNvm,
  runNvmLsFast,
  spawnNvm,
  setActiveVersionOverride,
  setLtsAliasFile,
  deleteLtsAliasFile,
  updateNvm,
  openNvmDir,
  fetchNvmLatestVersion,
} from './nvm.service.js';

/** Makes execFile invoke its callback with the given error/stdout/stderr. */
function mockExecFile(error: Error | null, stdout = '', stderr = ''): void {
  vi.mocked(childProcess.execFile).mockImplementation(
    (_cmd: unknown, _args: unknown, _opts: unknown, callback: unknown) => {
      (callback as (e: Error | null, o: string, s: string) => void)(error, stdout, stderr);
      return {} as ReturnType<typeof childProcess.execFile>;
    },
  );
}

// ── runNvm ────────────────────────────────────────────────────────────────────

/**
 * `runNvm` – verifies that the shell is invoked correctly and that errors are
 * surfaced as `NvmError` instances carrying the full stdout/stderr.
 */
describe('runNvm', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('gibt stdout und stderr bei Erfolg zurück', async () => {
    vi.mocked(childProcess.execFile).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        (callback as (err: null, stdout: string, stderr: string) => void)(
          null,
          '0.39.7\n',
          '',
        );
        return {} as ReturnType<typeof childProcess.execFile>;
      },
    );

    const result = await runNvm(['--version']);
    expect(result.stdout).toBe('0.39.7\n');
    expect(result.stderr).toBe('');
  });

  it('wirft NvmError bei Fehler', async () => {
    const fakeError = new Error('nvm not found');
    vi.mocked(childProcess.execFile).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        (callback as (err: Error, stdout: string, stderr: string) => void)(
          fakeError,
          '',
          'command not found: nvm',
        );
        return {} as ReturnType<typeof childProcess.execFile>;
      },
    );

    await expect(runNvm(['ls'])).rejects.toThrow(NvmError);
    await expect(runNvm(['ls'])).rejects.toThrow('nvm not found');
  });

  it('übergibt die korrekten Argumente an execFile', async () => {
    const execFileMock = vi.mocked(childProcess.execFile).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        (callback as (err: null, stdout: string, stderr: string) => void)(null, '', '');
        return {} as ReturnType<typeof childProcess.execFile>;
      },
    );

    await runNvm(['install', '22']);
    const [cmd, args] = execFileMock.mock.calls[0] as unknown as [string, string[]];
    expect(cmd).toBe('bash');
    expect(args[0]).toBe('-c');
    expect(args[1]).toContain("nvm 'install' '22'");
  });

  it('escaped Shell-Sonderzeichen in Argumenten', async () => {
    const execFileMock = vi.mocked(childProcess.execFile).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        (callback as (err: null, stdout: string, stderr: string) => void)(null, '', '');
        return {} as ReturnType<typeof childProcess.execFile>;
      },
    );

    await runNvm(["it's-a-test"]);
    const [, args] = execFileMock.mock.calls[0] as unknown as [string, string[]];
    // A single quote inside a single-quoted shell arg becomes '\'' (end quote,
    // literal quote, reopen quote). This ensures injection via quote characters
    // is neutralised even if the first validation layer is bypassed.
    expect(args[1]).toContain("'it'\\''s-a-test'");
  });
});

// ── runNvmLsFast ──────────────────────────────────────────────────────────────

/**
 * `runNvmLsFast` – filesystem-based version scan.
 * Tests cover the happy path, missing NVM_DIR, the active-version override
 * mechanism, partial-version resolution, and stale-override cleanup.
 */
describe('runNvmLsFast', () => {
  beforeEach(() => vi.resetAllMocks());

  it('gibt installierte Versionen aus dem Dateisystem zurück', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['v20.5.0', 'v22.11.0'] as never);
    vi.mocked(fs.readFile).mockResolvedValue('v22.11.0\n' as never);

    const result = await runNvmLsFast();
    expect(result.versions.length).toBeGreaterThan(0);
    expect(result.versions.some((v) => v.version === '22.11.0')).toBe(true);
    expect(result.stdout).toBe('');
  });

  it('gibt leere Versions-Liste zurück wenn Verzeichnis fehlt', async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error('ENOENT'));
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    const result = await runNvmLsFast();
    expect(result.versions).toHaveLength(0);
  });

  it('markiert die per Override gesetzte Version als aktiv', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['v20.5.0', 'v22.11.0'] as never);
    vi.mocked(fs.readFile).mockResolvedValue('v22.11.0\n' as never);

    setActiveVersionOverride('20.5.0');
    const result = await runNvmLsFast();
    setActiveVersionOverride(null);

    expect(result.versions.find((v) => v.version === '20.5.0')?.active).toBe(true);
    expect(result.versions.find((v) => v.version === '22.11.0')?.active).toBe(false);
  });

  it('löst eine partielle Version (Major) auf die höchste installierte auf', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['v22.11.0', 'v22.14.0'] as never);
    vi.mocked(fs.readFile).mockResolvedValue('v22.11.0\n' as never);

    setActiveVersionOverride('22');
    const result = await runNvmLsFast();
    setActiveVersionOverride(null);

    expect(result.versions.find((v) => v.version === '22.14.0')?.active).toBe(true);
  });

  it('ignoriert einen Override, dessen Version nicht installiert ist', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['v22.11.0'] as never);
    vi.mocked(fs.readFile).mockResolvedValue('v22.11.0\n' as never);

    setActiveVersionOverride('18.0.0');
    const result = await runNvmLsFast();
    setActiveVersionOverride(null);

    expect(result.versions.every((v) => !v.active)).toBe(true);
  });
});

// ── spawnNvm ──────────────────────────────────────────────────────────────────

/**
 * `spawnNvm` – ensures the SSE spawn wrapper calls `bash -c` with the
 * correctly escaped nvm command (same escaping as `runNvm`).
 */
describe('spawnNvm', () => {
  it('ruft spawn mit bash und -c auf', () => {
    const fakeChild = { stdout: null, stderr: null, on: vi.fn() };
    const spawnMock = vi.mocked(childProcess.spawn).mockReturnValue(
      fakeChild as unknown as ReturnType<typeof childProcess.spawn>,
    );

    spawnNvm(['install', '22']);
    const [cmd, args] = spawnMock.mock.calls[0] as unknown as [string, string[]];
    expect(cmd).toBe('bash');
    expect(args[0]).toBe('-c');
    expect(args[1]).toContain("nvm 'install' '22'");
  });
});

// ── Alias-Auflösung (über runNvmLsFast) ───────────────────────────────────────

/**
 * Alias-resolution within `runNvmLsFast`: verifies that multi-hop chains
 * (e.g. `default → lts/iron → v20.5.0`) are followed correctly, and that
 * circular chains are broken at the depth limit without crashing.
 */
describe('runNvmLsFast – Alias-Auflösung', () => {
  beforeEach(() => vi.resetAllMocks());

  it('löst eine lts/-Alias-Kette für die Default-Version auf', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['v20.5.0', 'v22.11.0'] as never);
    vi.mocked(fs.readFile).mockImplementation(async (p: unknown) => {
      const s = String(p);
      if (s.endsWith('/alias/default')) return 'lts/iron';
      if (s.endsWith('/alias/lts/iron')) return 'v20.5.0\n';
      throw new Error('ENOENT');
    });

    const result = await runNvmLsFast();
    expect(result.versions.find((v) => v.version === '20.5.0')?.default).toBe(true);
  });

  it('bricht zirkuläre Alias-Ketten ab (Tiefenlimit)', async () => {
    vi.mocked(fs.readdir).mockResolvedValue(['v20.5.0'] as never);
    // Circular chain: default → loop → loop → …
    // resolveAlias() aborts at depth 5 and returns null so no version is
    // marked as default – tested to prevent infinite recursion.
    vi.mocked(fs.readFile).mockImplementation(async (p: unknown) => {
      const s = String(p);
      if (s.endsWith('/alias/default')) return 'loop';
      if (s.endsWith('/alias/loop')) return 'loop';
      throw new Error('ENOENT');
    });

    const result = await runNvmLsFast();
    expect(result.versions.every((v) => !v.default)).toBe(true);
  });
});

// ── setLtsAliasFile / deleteLtsAliasFile ──────────────────────────────────────

/**
 * `setLtsAliasFile` – verifies that the lts alias directory is created as needed
 * and the version file is written with a canonical `v`-prefix.
 */
describe('setLtsAliasFile', () => {
  beforeEach(() => vi.resetAllMocks());

  it('legt das lts-Verzeichnis an und schreibt die Version mit v-Präfix', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined as never);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined as never);

    await setLtsAliasFile('iron', '20.5.0');

    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('/alias/lts'), {
      recursive: true,
    });
    const [file, content] = vi.mocked(fs.writeFile).mock.calls[0] as [string, string];
    expect(String(file)).toContain('/alias/lts/iron');
    expect(content).toBe('v20.5.0\n');
  });

  it('behält ein vorhandenes v-Präfix bei', async () => {
    vi.mocked(fs.mkdir).mockResolvedValue(undefined as never);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined as never);

    await setLtsAliasFile('hydrogen', 'v18.0.0');

    const [, content] = vi.mocked(fs.writeFile).mock.calls[0] as [string, string];
    expect(content).toBe('v18.0.0\n');
  });
});

/** `deleteLtsAliasFile` – verifies file removal and error propagation. */
describe('deleteLtsAliasFile', () => {
  beforeEach(() => vi.resetAllMocks());

  it('löscht die Alias-Datei', async () => {
    vi.mocked(fs.unlink).mockResolvedValue(undefined as never);

    await deleteLtsAliasFile('iron');

    expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('/alias/lts/iron'));
  });

  it('propagiert den Fehler, wenn die Datei nicht existiert', async () => {
    vi.mocked(fs.unlink).mockRejectedValue(new Error('ENOENT'));
    await expect(deleteLtsAliasFile('ghost')).rejects.toThrow('ENOENT');
  });
});

// ── fetchNvmLatestVersion ─────────────────────────────────────────────────────

/**
 * `fetchNvmLatestVersion` – verifies GitHub API integration and graceful null
 * fallback for every failure mode (HTTP error, missing `tag_name`, network error).
 */
describe('fetchNvmLatestVersion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gibt die Version ohne v-Präfix zurück', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tag_name: 'v0.40.4' }) }),
    );
    expect(await fetchNvmLatestVersion()).toBe('0.40.4');
  });

  it('gibt null bei nicht-ok Response zurück', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchNvmLatestVersion()).toBeNull();
  });

  it('gibt null wenn tag_name fehlt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(await fetchNvmLatestVersion()).toBeNull();
  });

  it('gibt null bei Netzwerkfehler zurück', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    expect(await fetchNvmLatestVersion()).toBeNull();
  });
});

// ── openNvmDir ────────────────────────────────────────────────────────────────

/**
 * `openNvmDir` – verifies platform-specific open command selection.
 * `process.platform` is overridden via `Object.defineProperty` so no real file
 * manager is launched. The original descriptor is restored after each test.
 */
describe('openNvmDir', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

  beforeEach(() => vi.resetAllMocks());
  afterEach(() => {
    if (originalPlatform) Object.defineProperty(process, 'platform', originalPlatform);
  });

  function setPlatform(value: string): void {
    Object.defineProperty(process, 'platform', { value, configurable: true });
  }

  it('nutzt "open" auf macOS', async () => {
    mockExecFile(null);
    setPlatform('darwin');
    await openNvmDir();
    const [cmd] = vi.mocked(childProcess.execFile).mock.calls[0] as unknown as [string];
    expect(cmd).toBe('open');
  });

  it('nutzt "xdg-open" auf Linux', async () => {
    mockExecFile(null);
    setPlatform('linux');
    await openNvmDir();
    const [cmd] = vi.mocked(childProcess.execFile).mock.calls[0] as unknown as [string];
    expect(cmd).toBe('xdg-open');
  });

  it('wirft einen Fehler, wenn das Öffnen fehlschlägt', async () => {
    mockExecFile(new Error('no such file'));
    await expect(openNvmDir()).rejects.toThrow('no such file');
  });
});

// ── updateNvm ─────────────────────────────────────────────────────────────────

/**
 * `updateNvm` – verifies the git-based nvm self-update flow.
 * Critically includes a test for the injection guard: a malicious `tag_name`
 * from the GitHub API must be rejected before the shell command is executed.
 */
describe('updateNvm', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  function mockFetchTag(tag: string): void {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tag_name: tag }) }),
    );
  }

  it('führt git fetch + checkout der neuesten Version aus', async () => {
    mockFetchTag('v0.40.4');
    mockExecFile(null, 'Switched', '');

    const result = await updateNvm();

    const [cmd, args] = vi.mocked(childProcess.execFile).mock.calls[0] as unknown as [
      string,
      string[],
    ];
    expect(cmd).toBe('bash');
    expect(args[1]).toContain("git checkout 'v0.40.4'");
    expect(result.stdout).toBe('Switched');
  });

  it('wirft NvmError, wenn die neueste Version nicht ermittelbar ist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(updateNvm()).rejects.toThrow(NvmError);
  });

  it('wirft NvmError bei ungültigem Versionsformat (Injection-Schutz) und führt nichts aus', async () => {
    mockFetchTag("0.40.4'; rm -rf ~ #");
    mockExecFile(null);

    await expect(updateNvm()).rejects.toThrow(NvmError);
    expect(childProcess.execFile).not.toHaveBeenCalled();
  });

  it('wirft NvmError, wenn git fehlschlägt', async () => {
    mockFetchTag('v0.40.4');
    mockExecFile(new Error('git checkout failed'), '', 'fatal');
    await expect(updateNvm()).rejects.toThrow(NvmError);
  });
});
