import { Router } from 'express';
import type { RequestHandler } from 'express';
import { runNvm, runNvmLsFast, spawnNvm, setLtsAliasFile, deleteLtsAliasFile, setActiveVersionOverride } from '../nvm/nvm.service.js';
import { parseAliases, parseRemoteVersions } from '../nvm/nvm.parser.js';
import { isValidVersionInput, isValidAliasName, isValidAliasTarget, isValidLtsCodename } from '../nvm/nvm.types.js';

const router = Router();

const getInstalledHandler: RequestHandler = async (_req, res, next) => {
  try {
    const result = await runNvmLsFast();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getRemoteHandler: RequestHandler = async (_req, res, next) => {
  try {
    const { stdout, stderr } = await runNvm(['ls-remote']);
    const versions = parseRemoteVersions(stdout);
    res.json({ stdout, stderr, versions });
  } catch (err) {
    next(err);
  }
};

const installHandler: RequestHandler = async (req, res, next) => {
  try {
    const { version } = req.body as { version: unknown };
    if (!isValidVersionInput(version)) {
      res.status(400).json({ error: `Ungültige Version: ${String(version)}` });
      return;
    }
    const result = await runNvm(['install', version]);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const useHandler: RequestHandler = async (req, res, next) => {
  try {
    const { version } = req.body as { version: unknown };
    if (!isValidVersionInput(version)) {
      res.status(400).json({ error: `Ungültige Version: ${String(version)}` });
      return;
    }
    // "Verwenden" setzt die Version nur aktiv, NICHT als Default.
    // nvm use validiert die Version und liefert "Now using node ...".
    // Da nvm use prozessgebunden ist, merken wir die aktive Version zusätzlich
    // als Override, damit GET /installed (und damit der Header) sie als aktiv
    // markiert. Der default-Alias bleibt unverändert.
    const result = await runNvm(['use', version]);
    setActiveVersionOverride(version);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const setDefaultHandler: RequestHandler = async (req, res, next) => {
  try {
    const { version } = req.body as { version: unknown };
    if (!isValidAliasTarget(version)) {
      res.status(400).json({ error: `Ungültiges Ziel: ${String(version)}` });
      return;
    }
    const result = await runNvm(['alias', 'default', version]);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const setStableHandler: RequestHandler = async (req, res, next) => {
  try {
    const { version } = req.body as { version: unknown };
    if (!isValidAliasTarget(version)) {
      res.status(400).json({ error: `Ungültiges Ziel: ${String(version)}` });
      return;
    }
    const result = await runNvm(['alias', 'stable', version]);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const setLtsAliasHandler: RequestHandler = async (req, res, next) => {
  try {
    const { codename, version } = req.body as { codename: unknown; version: unknown };
    if (!isValidLtsCodename(codename)) {
      res.status(400).json({ error: 'Ungültiger LTS-Codename.' });
      return;
    }
    if (!isValidAliasTarget(version)) {
      res.status(400).json({ error: `Ungültiges Ziel: ${String(version)}` });
      return;
    }
    await setLtsAliasFile(codename, version);
    res.json({ stdout: '', stderr: '' });
  } catch (err) {
    next(err);
  }
};

const uninstallHandler: RequestHandler = async (req, res, next) => {
  try {
    const { version } = req.body as { version: unknown };
    if (!isValidVersionInput(version)) {
      res.status(400).json({ error: `Ungültige Version: ${String(version)}` });
      return;
    }
    const result = await runNvm(['uninstall', version]);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const PROTECTED_ALIASES = new Set(['default', 'node', 'stable', 'unstable', 'iojs']);

const getAliasesHandler: RequestHandler = async (_req, res, next) => {
  try {
    const { stdout, stderr } = await runNvm(['alias']);
    const aliases = parseAliases(stdout);
    res.json({ stdout, stderr, aliases });
  } catch (err) {
    next(err);
  }
};

const setAliasHandler: RequestHandler = async (req, res, next) => {
  try {
    const { name, target } = req.body as { name: unknown; target: unknown };
    if (!isValidAliasName(name)) {
      res.status(400).json({ error: 'Ungültiger Alias-Name.' });
      return;
    }
    if (name.startsWith('lts/')) {
      res.status(400).json({ error: `LTS-Aliases über den dedizierten Endpunkt setzen.` });
      return;
    }
    if (!isValidAliasTarget(target)) {
      res.status(400).json({ error: 'Ungültiges Alias-Ziel.' });
      return;
    }
    const result = await runNvm(['alias', name, target]);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const deleteAliasHandler: RequestHandler = async (req, res, next) => {
  try {
    const { name } = req.params;
    if (!isValidAliasName(name)) {
      res.status(400).json({ error: 'Ungültiger Alias-Name.' });
      return;
    }
    if (PROTECTED_ALIASES.has(name)) {
      res.status(400).json({ error: `Alias '${name}' ist geschützt und kann nicht gelöscht werden.` });
      return;
    }
    const result = await runNvm(['unalias', name]);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const deleteLtsAliasHandler: RequestHandler = async (req, res, next) => {
  try {
    const { codename } = req.params;
    if (!isValidLtsCodename(codename)) {
      res.status(400).json({ error: 'Ungültiger LTS-Codename.' });
      return;
    }
    await deleteLtsAliasFile(codename);
    res.json({ stdout: '', stderr: '' });
  } catch (err) {
    next(err);
  }
};

/**
 * SSE endpoint for live output during `nvm install`.
 * The MVP uses the regular POST /install; this endpoint is prepared for future UI integration.
 */
const installStreamHandler: RequestHandler = (req, res) => {
  const { version } = req.query as { version: unknown };
  if (!isValidVersionInput(version)) {
    res.status(400).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const child = spawnNvm(['install', version]);

  const send = (type: string, line: string): void => {
    res.write(`data: ${JSON.stringify({ type, line })}\n\n`);
  };

  child.stdout?.on('data', (chunk: Buffer) => send('stdout', chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => send('stderr', chunk.toString()));
  child.on('close', (code) => {
    send('done', String(code));
    res.end();
  });
  req.on('close', () => child.kill());
};

router.get('/installed', getInstalledHandler);
router.get('/remote', getRemoteHandler);
router.get('/aliases', getAliasesHandler);
router.get('/install/stream', installStreamHandler);
router.post('/install', installHandler);
router.post('/use', useHandler);
router.post('/default', setDefaultHandler);
router.post('/stable', setStableHandler);
router.post('/uninstall', uninstallHandler);
router.post('/aliases', setAliasHandler);
router.post('/aliases/lts', setLtsAliasHandler);
router.delete('/aliases/lts/:codename', deleteLtsAliasHandler);
router.delete('/aliases/:name', deleteAliasHandler);

export default router;
