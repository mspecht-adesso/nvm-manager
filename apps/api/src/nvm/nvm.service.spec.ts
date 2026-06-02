import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NvmError } from './nvm.types.js';

vi.mock('node:child_process');

import * as childProcess from 'node:child_process';
import { runNvm, runNvmLs, spawnNvm } from './nvm.service.js';

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
    expect(args[0]).toBe('-lc');
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

// ── runNvmLs ──────────────────────────────────────────────────────────────────

describe('runNvmLs', () => {
  beforeEach(() => vi.resetAllMocks());

  it('gibt stdout und stderr bei Erfolg zurück', async () => {
    vi.mocked(childProcess.execFile).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        (callback as (err: null, stdout: string, stderr: string) => void)(
          null,
          '->     v22.11.0 (default)',
          '',
        );
        return {} as ReturnType<typeof childProcess.execFile>;
      },
    );

    const result = await runNvmLs();
    expect(result.stdout).toContain('v22.11.0');
  });

  it('wirft NvmError bei Fehler', async () => {
    vi.mocked(childProcess.execFile).mockImplementation(
      (_cmd, _args, _opts, callback) => {
        (callback as (err: Error, stdout: string, stderr: string) => void)(
          new Error('exec failed'),
          '',
          '',
        );
        return {} as ReturnType<typeof childProcess.execFile>;
      },
    );

    await expect(runNvmLs()).rejects.toThrow(NvmError);
  });
});

// ── spawnNvm ──────────────────────────────────────────────────────────────────

describe('spawnNvm', () => {
  it('ruft spawn mit bash und -lc auf', () => {
    const fakeChild = { stdout: null, stderr: null, on: vi.fn() };
    const spawnMock = vi.mocked(childProcess.spawn).mockReturnValue(
      fakeChild as unknown as ReturnType<typeof childProcess.spawn>,
    );

    spawnNvm(['install', '22']);
    const [cmd, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(cmd).toBe('bash');
    expect(args[0]).toBe('-lc');
    expect(args[1]).toContain("nvm 'install' '22'");
  });
});
