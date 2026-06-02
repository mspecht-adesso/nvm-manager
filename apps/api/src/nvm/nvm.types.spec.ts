import { describe, it, expect } from 'vitest';
import { isValidVersionInput, isValidAliasName, isValidAliasTarget, NvmError } from './nvm.types.js';

// ── isValidVersionInput ───────────────────────────────────────────────────────

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
    expect(isValidVersionInput('$(whoami)')).toBe(false);
    expect(isValidVersionInput('`id`')).toBe(false);
    expect(isValidVersionInput('22; cat /etc/passwd')).toBe(false);
  });
});

// ── isValidAliasName ──────────────────────────────────────────────────────────

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
