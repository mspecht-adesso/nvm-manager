import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NvmError } from './nvm.types.js';

vi.mock('node:child_process');
vi.mock('node:fs/promises');

import * as childProcess from 'node:child_process';
import * as fs from 'node:fs/promises';
import { runNvm, runNvmLsFast, spawnNvm, setActiveVersionOverride } from './nvm.service.js';

// ── runNvm ────────────────────────────────────────────────────────────────────

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
    const [cmd, args] = execFileMock.mock.calls[0] as [string, string[]];
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
    const [, args] = execFileMock.mock.calls[0] as [string, string[]];
    expect(args[1]).toContain("'it'\\''s-a-test'");
  });
});

// ── runNvmLsFast ──────────────────────────────────────────────────────────────

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

describe('spawnNvm', () => {
  it('ruft spawn mit bash und -c auf', () => {
    const fakeChild = { stdout: null, stderr: null, on: vi.fn() };
    const spawnMock = vi.mocked(childProcess.spawn).mockReturnValue(
      fakeChild as unknown as ReturnType<typeof childProcess.spawn>,
    );

    spawnNvm(['install', '22']);
    const [cmd, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('bash');
    expect(args[0]).toBe('-c');
    expect(args[1]).toContain("nvm 'install' '22'");
  });
});
