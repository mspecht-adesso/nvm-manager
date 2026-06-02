import { Router } from 'express';
import type { RequestHandler } from 'express';
import { runNvm, runNvmLs, spawnNvm } from '../nvm/nvm.service.js';
import { parseInstalledVersions, parseAliases, parseRemoteVersions } from '../nvm/nvm.parser.js';
import { isValidVersionInput, isValidAliasName, isValidAliasTarget } from '../nvm/nvm.types.js';

const router = Router();

const getInstalledHandler: RequestHandler = async (_req, res, next) => {
  try {
    // nvm use default vor nvm ls in derselben Shell: zeigt die korrekte aktive Version (->) an.
    const { stdout, stderr } = await runNvmLs();
    const versions = parseInstalledVersions(stdout);
    res.json({ stdout, stderr, versions });
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
    // Persistenter Wechsel: nvm alias default setzt die Version dauerhaft in ~/.nvm/alias/default.
    // Dadurch zeigt GET /installed nach dem Wechsel korrekt die neue aktive Version an.
    const result = await runNvm(['alias', 'default', version]);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const setDefaultHandler: RequestHandler = async (req, res, next) => {
  try {
    const { version } = req.body as { version: unknown };
    if (!isValidVersionInput(version)) {
      res.status(400).json({ error: `Ungültige Version: ${String(version)}` });
      return;
    }
    const result = await runNvm(['alias', 'default', version]);
    res.json(result);
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

const READONLY_ALIASES = new Set(['node', 'stable', 'unstable']);

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
    if (READONLY_ALIASES.has(name) || name.startsWith('lts/')) {
      res.status(400).json({ error: `Alias '${name}' ist schreibgeschützt.` });
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
    if (READONLY_ALIASES.has(name) || name.startsWith('lts/') || name === 'default') {
      res.status(400).json({ error: `Alias '${name}' kann nicht gelöscht werden.` });
      return;
    }
    const result = await runNvm(['unalias', name]);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * SSE-Endpoint für Live-Output während `nvm install`.
 * Der MVP nutzt den regulären POST /install, dieser Endpoint ist für spätere UI-Integration vorbereitet.
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
router.post('/uninstall', uninstallHandler);
router.post('/aliases', setAliasHandler);
router.delete('/aliases/:name', deleteAliasHandler);

export default router;
