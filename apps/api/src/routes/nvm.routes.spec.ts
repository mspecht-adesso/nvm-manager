import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../nvm/nvm.service.js');
vi.mock('../nvm/nvm.parser.js');

import * as svc from '../nvm/nvm.service.js';
import * as parser from '../nvm/nvm.parser.js';
import { createApp } from '../server.js';
import { NvmError } from '../nvm/nvm.types.js';


const app = createApp();

const INSTALLED_STDOUT = '->     v22.11.0 (default)\n       v20.5.0';
const ALIASES_STDOUT = 'default -> lts/* (-> v22.11.0)\nmy-alias -> v18.18.0';
const REMOTE_STDOUT = '   v22.0.0   (Latest LTS: Jod)';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(svc.fetchNvmLatestVersion).mockResolvedValue(null);
  vi.mocked(svc.openNvmDir).mockResolvedValue(undefined);
});

// ── GET /api/status ────────────────────────────────────────────────────────────

describe('GET /api/status', () => {
  it('gibt 200 mit nvm-Version zurück', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: '0.39.7\n', stderr: '' });

    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.nvmVersion).toBe('0.39.7');
  });

  it('enthält nvmLatestVersion wenn GitHub-Abfrage erfolgreich', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: '0.39.7\n', stderr: '' });
    vi.mocked(svc.fetchNvmLatestVersion).mockResolvedValue('0.40.4');

    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.nvmLatestVersion).toBe('0.40.4');
  });

  it('enthält kein nvmLatestVersion wenn GitHub-Abfrage fehlschlägt', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: '0.39.7\n', stderr: '' });
    vi.mocked(svc.fetchNvmLatestVersion).mockResolvedValue(null);

    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('nvmLatestVersion');
  });

  it('gibt ok: false zurück wenn nvm nicht erreichbar', async () => {
    vi.mocked(svc.runNvm).mockRejectedValue(new NvmError('nvm not found', '', ''));

    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body).toHaveProperty('error');
  });
});

// ── POST /api/nvm/update ──────────────────────────────────────────────────────

describe('POST /api/nvm/update', () => {
  it('gibt 200 zurück wenn nvm upgrade erfolgreich', async () => {
    vi.mocked(svc.updateNvm).mockResolvedValue({ stdout: 'nvm upgraded to v0.40.4', stderr: '' });

    const res = await request(app).post('/api/nvm/update');
    expect(res.status).toBe(200);
    expect(res.body.stdout).toContain('upgraded');
  });

  it('gibt 500 zurück wenn nvm upgrade fehlschlägt', async () => {
    vi.mocked(svc.updateNvm).mockRejectedValue(new NvmError('upgrade failed', '', 'stderr'));

    const res = await request(app).post('/api/nvm/update');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ── POST /api/nvm/open-dir ────────────────────────────────────────────────────

describe('POST /api/nvm/open-dir', () => {
  it('gibt 200 zurück wenn Ordner erfolgreich geöffnet', async () => {
    vi.mocked(svc.openNvmDir).mockResolvedValue(undefined);

    const res = await request(app).post('/api/nvm/open-dir');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('gibt 500 zurück wenn Ordner nicht geöffnet werden kann', async () => {
    vi.mocked(svc.openNvmDir).mockRejectedValue(new Error('open failed: No such file'));

    const res = await request(app).post('/api/nvm/open-dir');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ── GET /api/versions/installed ───────────────────────────────────────────────

describe('GET /api/versions/installed', () => {
  it('gibt 200 mit installierten Versionen zurück', async () => {
    vi.mocked(svc.runNvmLsFast).mockResolvedValue({
      stdout: '',
      stderr: '',
      versions: [
        { version: '22.11.0', active: true, default: true, system: false, stable: true, unstable: false, iojs: false },
        { version: '20.5.0', active: false, default: false, system: false, stable: false, unstable: false, iojs: false },
      ],
    });

    const res = await request(app).get('/api/versions/installed');
    expect(res.status).toBe(200);
    expect(res.body.versions).toHaveLength(2);
    expect(res.body.versions[0].active).toBe(true);
    expect(res.body.versions[0].stable).toBe(true);
  });

  it('gibt 500 zurück wenn runNvmLsFast fehlschlägt', async () => {
    vi.mocked(svc.runNvmLsFast).mockRejectedValue(new NvmError('exec failed', '', 'stderr'));

    const res = await request(app).get('/api/versions/installed');
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
  });
});

// ── GET /api/versions/remote ──────────────────────────────────────────────────

describe('GET /api/versions/remote', () => {
  it('gibt 200 mit Remote-Versionen zurück', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: REMOTE_STDOUT, stderr: '' });
    vi.mocked(parser.parseRemoteVersions).mockReturnValue([
      { version: '22.0.0', lts: 'Jod' },
    ]);

    const res = await request(app).get('/api/versions/remote');
    expect(res.status).toBe(200);
    expect(res.body.versions).toHaveLength(1);
    expect(res.body.versions[0].lts).toBe('Jod');
  });
});

// ── GET /api/versions/aliases ─────────────────────────────────────────────────

describe('GET /api/versions/aliases', () => {
  it('gibt 200 mit Aliases zurück', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: ALIASES_STDOUT, stderr: '' });
    vi.mocked(parser.parseAliases).mockReturnValue([
      { name: 'default', target: 'lts/*', resolved: 'v22.11.0', editable: true, deletable: false },
    ]);

    const res = await request(app).get('/api/versions/aliases');
    expect(res.status).toBe(200);
    expect(res.body.aliases).toHaveLength(1);
  });
});

// ── POST /api/versions/install ────────────────────────────────────────────────

describe('POST /api/versions/install', () => {
  it('gibt 400 bei ungültiger Version zurück', async () => {
    const res = await request(app).post('/api/versions/install').send({ version: '../evil; rm -rf /' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('gibt 400 bei fehlendem Body zurück', async () => {
    const res = await request(app).post('/api/versions/install').send({});
    expect(res.status).toBe(400);
  });

  it('gibt 200 bei gültiger Version zurück', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: 'Now using node v22', stderr: '' });

    const res = await request(app).post('/api/versions/install').send({ version: '22' });
    expect(res.status).toBe(200);
    expect(res.body.stdout).toContain('v22');
  });

  it('gibt 500 zurück wenn nvm fehlschlägt', async () => {
    vi.mocked(svc.runNvm).mockRejectedValue(new NvmError('version not found', '', ''));

    const res = await request(app).post('/api/versions/install').send({ version: '999' });
    expect(res.status).toBe(500);
  });

  it.each(['22', '22.11', '22.11.0', 'node', 'stable', 'lts/*'])(
    'akzeptiert gültige Version "%s"',
    async (version) => {
      vi.mocked(svc.runNvm).mockResolvedValue({ stdout: '', stderr: '' });
      const res = await request(app).post('/api/versions/install').send({ version });
      expect(res.status).toBe(200);
    },
  );
});

// ── POST /api/versions/use ────────────────────────────────────────────────────

describe('POST /api/versions/use', () => {
  it('gibt 400 bei ungültiger Version zurück', async () => {
    const res = await request(app).post('/api/versions/use').send({ version: '; evil' });
    expect(res.status).toBe(400);
  });

  it('gibt 200 bei gültiger Version zurück', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: 'Now using node v20', stderr: '' });

    const res = await request(app).post('/api/versions/use').send({ version: '20' });
    expect(res.status).toBe(200);
  });
});

// ── POST /api/versions/default ────────────────────────────────────────────────

describe('POST /api/versions/default', () => {
  it('gibt 400 bei ungültiger Version zurück', async () => {
    const res = await request(app).post('/api/versions/default').send({ version: 'v22 && echo' });
    expect(res.status).toBe(400);
  });

  it('gibt 200 bei gültiger Version zurück', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: '', stderr: '' });

    const res = await request(app).post('/api/versions/default').send({ version: '22' });
    expect(res.status).toBe(200);
  });
});

// ── POST /api/versions/uninstall ──────────────────────────────────────────────

describe('POST /api/versions/uninstall', () => {
  it('gibt 400 bei ungültiger Version zurück', async () => {
    const res = await request(app).post('/api/versions/uninstall').send({ version: '' });
    expect(res.status).toBe(400);
  });

  it('gibt 200 bei gültiger Version zurück', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: 'Uninstalled', stderr: '' });

    const res = await request(app).post('/api/versions/uninstall').send({ version: '18' });
    expect(res.status).toBe(200);
  });
});

// ── POST /api/versions/aliases ────────────────────────────────────────────────

describe('POST /api/versions/aliases', () => {
  it('gibt 400 bei ungültigem Alias-Namen zurück', async () => {
    const res = await request(app)
      .post('/api/versions/aliases')
      .send({ name: '1invalid', target: '22' });
    expect(res.status).toBe(400);
  });

  it('gibt 400 wenn lts/-Alias über den generischen Endpunkt gesetzt wird', async () => {
    const res = await request(app)
      .post('/api/versions/aliases')
      .send({ name: 'lts/iron', target: '22' });
    expect(res.status).toBe(400);
  });

  it('gibt 400 bei lts/-Alias zurück', async () => {
    const res = await request(app)
      .post('/api/versions/aliases')
      .send({ name: 'lts/iron', target: '22' });
    expect(res.status).toBe(400);
  });

  it('gibt 400 bei ungültigem Alias-Ziel zurück', async () => {
    const res = await request(app)
      .post('/api/versions/aliases')
      .send({ name: 'myAlias', target: '../evil' });
    expect(res.status).toBe(400);
  });

  it('gibt 200 bei gültigem Alias zurück', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: '', stderr: '' });

    const res = await request(app)
      .post('/api/versions/aliases')
      .send({ name: 'myAlias', target: '22' });
    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/versions/aliases/:name ────────────────────────────────────────

describe('DELETE /api/versions/aliases/:name', () => {
  it('gibt 400 bei ungültigem Alias-Namen zurück', async () => {
    const res = await request(app).delete('/api/versions/aliases/1invalid');
    expect(res.status).toBe(400);
  });

  it('gibt 400 beim Versuch default zu löschen zurück', async () => {
    const res = await request(app).delete('/api/versions/aliases/default');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('nicht gelöscht');
  });

  it('gibt 400 beim Versuch einen eingebauten Alias zu löschen zurück', async () => {
    for (const name of ['node', 'stable', 'unstable']) {
      const res = await request(app).delete(`/api/versions/aliases/${name}`);
      expect(res.status).toBe(400);
    }
  });

  it('gibt 200 bei gültigem benutzerdefinierten Alias zurück', async () => {
    vi.mocked(svc.runNvm).mockResolvedValue({ stdout: '', stderr: '' });

    const res = await request(app).delete('/api/versions/aliases/myAlias');
    expect(res.status).toBe(200);
  });
});

// ── GET /api/versions/install/stream ─────────────────────────────────────────

describe('GET /api/versions/install/stream', () => {
  it('gibt 400 bei fehlender Version zurück', async () => {
    const res = await request(app).get('/api/versions/install/stream');
    expect(res.status).toBe(400);
  });

  it('gibt 400 bei ungültiger Version zurück', async () => {
    const res = await request(app)
      .get('/api/versions/install/stream')
      .query({ version: '; evil' });
    expect(res.status).toBe(400);
  });
});
