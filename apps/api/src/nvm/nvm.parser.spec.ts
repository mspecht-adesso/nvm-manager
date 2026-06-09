/**
 * Unit tests for the pure output-parsing functions in `nvm.parser.ts`.
 *
 * Tests use fixed stdout strings instead of spawning real nvm processes so
 * they run instantly, offline, and without nvm being installed.
 */
import { describe, it, expect } from 'vitest';
import { parseRemoteVersions, parseAliases } from './nvm.parser.js';

// ── parseRemoteVersions ───────────────────────────────────────────────────────

/**
 * `parseRemoteVersions` – converts raw `nvm ls-remote` stdout into a structured
 * list of remote versions with optional LTS codenames.
 */
describe('parseRemoteVersions', () => {
  it('parst LTS-Versionen mit Codename', () => {
    const stdout = '   v20.19.1   (LTS: Iron)\n   v22.15.0   (Latest LTS: Jod)';
    const result = parseRemoteVersions(stdout);
    expect(result.find((v) => v.version === '20.19.1')).toMatchObject({ lts: 'Iron' });
    expect(result.find((v) => v.version === '22.15.0')).toMatchObject({ lts: 'Jod' });
  });

  it('parst nicht-LTS-Versionen mit lts: null', () => {
    const stdout = '   v25.0.0\n   v24.0.0';
    const result = parseRemoteVersions(stdout);
    expect(result.every((v) => v.lts === null)).toBe(true);
  });

  it('gibt leeres Array bei leerem stdout zurück', () => {
    expect(parseRemoteVersions('')).toEqual([]);
  });

  it('liefert Versionen in absteigender Reihenfolge (neueste zuerst)', () => {
    const stdout = '   v18.0.0\n   v20.0.0\n   v22.0.0';
    const result = parseRemoteVersions(stdout);
    expect(result[0].version).toBe('22.0.0');
    expect(result[result.length - 1].version).toBe('18.0.0');
  });

  it('entfernt ANSI-Farbcodes', () => {
    const stdout = '\x1b[32m   v22.0.0\x1b[0m   (Latest LTS: Jod)';
    const result = parseRemoteVersions(stdout);
    expect(result[0]).toMatchObject({ version: '22.0.0', lts: 'Jod' });
  });

  it('ignoriert Zeilen ohne Versionsnummer', () => {
    const stdout = '   v20.0.0\nNone yet\n\n';
    const result = parseRemoteVersions(stdout);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('20.0.0');
  });
});

// ── parseAliases ──────────────────────────────────────────────────────────────

/**
 * `parseAliases` – converts raw `nvm alias` stdout into structured alias objects
 * with `editable` and `deletable` flags derived from alias category.
 */
describe('parseAliases', () => {
  it('parst Standard-Alias mit aufgelöster Version', () => {
    const stdout = 'default -> lts/* (-> v22.20.0)';
    const result = parseAliases(stdout);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'default',
      target: 'lts/*',
      resolved: 'v22.20.0',
      editable: true,
      deletable: false,
    });
  });

  it('setzt editable/deletable korrekt für geschützte Kern-Aliases', () => {
    const stdout = [
      'node -> stable (-> v22.20.0)',
      'stable -> v22.20.0 (default)',
      'unstable -> v0.11.6 (-> N/A)',
      'default -> lts/* (-> v22.20.0)',
      'iojs -> v0.11.6',
    ].join('\n');
    const result = parseAliases(stdout);
    result.forEach((a) => {
      // Built-in aliases (default, node, stable, unstable, iojs) are inline-editable
      // but must never be deleted – so editable: true and deletable: false.
      expect(a.editable).toBe(true);
      expect(a.deletable).toBe(false);
    });
  });

  it('setzt editable/deletable korrekt für lts-Aliases', () => {
    const stdout = 'lts/iron -> v20.19.1 (-> N/A)';
    const result = parseAliases(stdout);
    // LTS aliases must be changed via the dedicated POST /aliases/lts endpoint
    // (nvm rejects `nvm alias lts/…`), so editable: false.
    // They are not built-in and can be deleted → deletable: true.
    expect(result[0].editable).toBe(false);
    expect(result[0].deletable).toBe(true);
  });

  it('parst benutzerdefinierten Alias korrekt', () => {
    const stdout = 'my-project -> v18.18.0';
    const result = parseAliases(stdout);
    expect(result[0]).toMatchObject({
      name: 'my-project',
      target: 'v18.18.0',
      resolved: 'v18.18.0',
      editable: true,
      deletable: true,
    });
  });

  it('setzt resolved auf null wenn keine Version auflösbar', () => {
    // `(-> N/A)` means nvm could not resolve the target to a concrete version,
    // and the target `lts/*` itself is not a semver → resolved must be null.
    const stdout = 'my-alias -> lts/* (-> N/A)';
    const result = parseAliases(stdout);
    expect(result[0].resolved).toBeNull();
  });

  it('setzt resolved auf target wenn target ein direkter Semver ist', () => {
    const stdout = 'lts/iron -> v20.19.1 (-> N/A)';
    const result = parseAliases(stdout);
    expect(result[0].resolved).toBe('v20.19.1');
  });

  it('gibt leeres Array bei leerem stdout zurück', () => {
    expect(parseAliases('')).toEqual([]);
  });

  it('entfernt ANSI-Farbcodes', () => {
    const stdout = '\x1b[33mmy-alias\x1b[0m -> v18.0.0';
    const result = parseAliases(stdout);
    expect(result[0].name).toBe('my-alias');
  });

  it('ignoriert Zeilen ohne " -> "', () => {
    const stdout = 'default -> v22.11.0\nThis line has no arrow';
    const result = parseAliases(stdout);
    expect(result).toHaveLength(1);
  });
});
