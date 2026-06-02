import { describe, it, expect } from 'vitest';
import { parseInstalledVersions, parseRemoteVersions, parseAliases } from './nvm.parser.js';

// ── parseInstalledVersions ────────────────────────────────────────────────────

describe('parseInstalledVersions', () => {
  it('parst aktive Default-Version', () => {
    const stdout = '->     v22.11.0 (default)\n       v20.5.0\n       system';
    const result = parseInstalledVersions(stdout);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ version: '22.11.0', active: true, default: true });
    expect(result[1]).toMatchObject({ version: '20.5.0', active: false, default: false });
  });

  it('gibt leeres Array bei leerem stdout zurück', () => {
    expect(parseInstalledVersions('')).toEqual([]);
  });

  it('ignoriert Alias- und Zusammenfassungszeilen', () => {
    const stdout = [
      '->     v22.11.0 (default)',
      'default -> v22.11.0 (-> v22.11.0)',
      'node -> stable (-> v22.11.0)',
      'lts/iron -> v20.19.1 (-> N/A)',
      '       v18.20.7',
    ].join('\n');
    const result = parseInstalledVersions(stdout);
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.version)).toEqual(['22.11.0', '18.20.7']);
  });

  it('entfernt ANSI-Farbcodes', () => {
    const stdout = '\x1b[32m->\x1b[0m     v20.0.0 (default)';
    const result = parseInstalledVersions(stdout);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ version: '20.0.0', active: true, default: true });
  });

  it('markiert keine Version als aktiv wenn kein "->" vorhanden', () => {
    const stdout = '       v18.20.7\n       v20.5.0';
    const result = parseInstalledVersions(stdout);
    expect(result.every((v) => !v.active)).toBe(true);
  });

  it('gibt system: false für normale Versionszeilen zurück', () => {
    const stdout = '       v18.20.7';
    const result = parseInstalledVersions(stdout);
    expect(result[0].system).toBe(false);
  });

  it('parst mehrere Versionen korrekt', () => {
    const stdout = [
      '->     v22.11.0 (default)',
      '       v20.18.0',
      '       v18.20.7',
    ].join('\n');
    const result = parseInstalledVersions(stdout);
    expect(result).toHaveLength(3);
    expect(result[0].active).toBe(true);
    expect(result[1].active).toBe(false);
    expect(result[2].active).toBe(false);
  });
});

// ── parseRemoteVersions ───────────────────────────────────────────────────────

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

  it('setzt editable/deletable korrekt für eingebaute Aliases', () => {
    const stdout = [
      'node -> stable (-> v22.20.0)',
      'stable -> v22.20.0 (default)',
      'unstable -> v0.11.6 (-> N/A)',
    ].join('\n');
    const result = parseAliases(stdout);
    result.forEach((a) => {
      expect(a.editable).toBe(false);
      expect(a.deletable).toBe(false);
    });
  });

  it('setzt editable/deletable korrekt für lts-Aliases', () => {
    const stdout = 'lts/iron -> v20.19.1 (-> N/A)';
    const result = parseAliases(stdout);
    expect(result[0].editable).toBe(false);
    expect(result[0].deletable).toBe(false);
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
    // target ist kein konkreter Semver, und (-> N/A) liefert keine auflösbare Version
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
