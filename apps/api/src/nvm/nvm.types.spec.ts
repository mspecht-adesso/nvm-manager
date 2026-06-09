/**
 * Unit tests for the input-validation type guards in `nvm.types.ts`.
 *
 * These guards are the first shell-injection defence layer. The test suite
 * verifies both the happy path (known safe inputs) and rejection cases
 * (path traversal, shell metacharacters, wrong types, etc.).
 */
import { describe, it, expect } from 'vitest';
import { isValidVersionInput, isValidAliasName, isValidAliasTarget, NvmError } from './nvm.types.js';

// ── isValidVersionInput ───────────────────────────────────────────────────────

/**
 * `isValidVersionInput` – whitelist guard for the `version` field used in
 * install/use/uninstall calls.
 */
describe('isValidVersionInput', () => {
  it.each(['22', '22.11', '22.11.0', 'node', 'stable', 'lts/*'])(
    'akzeptiert "%s"',
    (v) => expect(isValidVersionInput(v)).toBe(true),
  );

  it.each(['../etc/passwd', '; rm -rf /', '', 'lts/iron', '22.11.0.1', 'v22', '22 && echo'])(
    'lehnt "%s" ab',
    (v) => expect(isValidVersionInput(v)).toBe(false),
  );

  it('lehnt Nicht-String-Werte ab', () => {
    expect(isValidVersionInput(42)).toBe(false);
    expect(isValidVersionInput(null)).toBe(false);
    expect(isValidVersionInput(undefined)).toBe(false);
    expect(isValidVersionInput({ version: '22' })).toBe(false);
  });

  it('verhindert Shell-Injection-Versuche', () => {
    // Command substitution, backtick injection, and semicolon-based chaining
    // must all be rejected before the value reaches the shell.
    expect(isValidVersionInput('$(whoami)')).toBe(false);
    expect(isValidVersionInput('`id`')).toBe(false);
    expect(isValidVersionInput('22; cat /etc/passwd')).toBe(false);
  });
});

// ── isValidAliasName ──────────────────────────────────────────────────────────

/**
 * `isValidAliasName` – whitelist guard for user-defined alias names.
 * Must start with a letter and be at most 50 characters.
 */
describe('isValidAliasName', () => {
  it.each(['default', 'myAlias', 'my-alias', 'my_alias', 'project123'])(
    'akzeptiert "%s"',
    (v) => expect(isValidAliasName(v)).toBe(true),
  );

  it.each(['', '1starts-with-digit', 'lts/iron', 'a b', '../etc', 'alias; rm -rf /', 'a'.repeat(51)])(
    'lehnt "%s" ab',
    (v) => expect(isValidAliasName(v)).toBe(false),
  );

  it('lehnt Nicht-String-Werte ab', () => {
    expect(isValidAliasName(null)).toBe(false);
    expect(isValidAliasName(undefined)).toBe(false);
    expect(isValidAliasName(42)).toBe(false);
  });

  it('akzeptiert Name mit genau 50 Zeichen', () => {
    expect(isValidAliasName('a' + 'b'.repeat(49))).toBe(true);
  });

  it('lehnt Name mit 51 Zeichen ab', () => {
    expect(isValidAliasName('a' + 'b'.repeat(50))).toBe(false);
  });
});

// ── isValidAliasTarget ────────────────────────────────────────────────────────

/**
 * `isValidAliasTarget` – whitelist guard for alias targets (broader than
 * `isValidVersionInput` because it also accepts symbolic names and LTS paths).
 */
describe('isValidAliasTarget', () => {
  it.each(['node', 'stable', 'unstable', 'lts/*', 'lts/iron', 'lts/hydrogen', 'v22.11.0', '22', '22.11', '22.11.0'])(
    'akzeptiert "%s"',
    (v) => expect(isValidAliasTarget(v)).toBe(true),
  );

  it.each(['', '../etc', '; rm -rf /', 'v22 && echo', 'lts/', 'lts/ iron'])(
    'lehnt "%s" ab',
    (v) => expect(isValidAliasTarget(v)).toBe(false),
  );

  it('lehnt Nicht-String-Werte ab', () => {
    expect(isValidAliasTarget(null)).toBe(false);
    expect(isValidAliasTarget(undefined)).toBe(false);
    expect(isValidAliasTarget(22)).toBe(false);
  });
});

// ── NvmError ──────────────────────────────────────────────────────────────────

/**
 * `NvmError` – custom error class that carries `stdout`/`stderr` from failed
 * nvm commands for inclusion in error middleware JSON responses.
 */
describe('NvmError', () => {
  it('erstellt Instanz mit korrekten Eigenschaften', () => {
    const err = new NvmError('Fehlermeldung', 'stdout-text', 'stderr-text');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NvmError);
    expect(err.message).toBe('Fehlermeldung');
    expect(err.stdout).toBe('stdout-text');
    expect(err.stderr).toBe('stderr-text');
    expect(err.name).toBe('NvmError');
  });

  it('ist mit instanceof Error erkennbar', () => {
    const err = new NvmError('test', '', '');
    expect(err instanceof Error).toBe(true);
  });
});
