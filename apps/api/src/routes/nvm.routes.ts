/**
 * Express router for all `/api/versions/*` endpoints.
 *
 * Every handler follows the same pattern:
 *   1. Validate request params/body with the whitelist guards from `nvm.types.ts`.
 *   2. Call the appropriate service function (or parser).
 *   3. Respond with JSON or forward the error to the central error middleware.
 *
 * Route table:
 * | Method | Path                                | Description                         |
 * |--------|-------------------------------------|-------------------------------------|
 * | GET    | /installed                          | Installed versions (fast FS scan)   |
 * | GET    | /remote                             | All available remote versions       |
 * | GET    | /aliases                            | All nvm aliases                     |
 * | GET    | /install/stream                     | SSE live output for nvm install     |
 * | POST   | /install                            | Install a version                   |
 * | POST   | /use                                | Use a version (session + override)  |
 * | POST   | /default                            | Set the default alias               |
 * | POST   | /stable                             | Set the stable alias                |
 * | POST   | /uninstall                          | Uninstall a version                 |
 * | POST   | /aliases                            | Create/update a custom alias        |
 * | POST   | /aliases/lts                        | Create/update an LTS alias          |
 * | DELETE | /aliases/lts/:codename              | Delete an LTS alias                 |
 * | DELETE | /aliases/:name                      | Delete a custom alias               |
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { runNvm, runNvmLsFast, spawnNvm, setLtsAliasFile, deleteLtsAliasFile, setActiveVersionOverride } from '../nvm/nvm.service.js';
import { parseAliases, parseRemoteVersions } from '../nvm/nvm.parser.js';
import { isValidVersionInput, isValidAliasName, isValidAliasTarget, isValidLtsCodename } from '../nvm/nvm.types.js';

const router = Router();

/** GET /installed – returns all locally installed Node.js versions with their flags. */
const getInstalledHandler: RequestHandler = async (_req, res, next) => {
  try {
    const result = await runNvmLsFast();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/** GET /remote – fetches all versions available from the nvm remote index. */
const getRemoteHandler: RequestHandler = async (_req, res, next) => {
  try {
    const { stdout, stderr } = await runNvm(['ls-remote']);
    const versions = parseRemoteVersions(stdout);
    res.json({ stdout, stderr, versions });
  } catch (err) {
    next(err);
  }
};

/** POST /install – installs a specific Node.js version via `nvm install`. */
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

/**
 * POST /use – activates a Node.js version in the current session.
 *
 * Unlike `POST /default`, this does NOT change the default alias; the version
 * is only "active" until the next server restart. The override is stored via
 * {@link setActiveVersionOverride} so that `GET /installed` reflects the change
 * in the UI header even though `PATH` itself is unchanged.
 */
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

/**
 * POST /default – persistently sets the nvm default alias via `nvm alias default <version>`.
 * Uses {@link isValidAliasTarget} (broader than `isValidVersionInput`) so that
 * symbolic targets like `lts/*` or `stable` are also accepted.
 */
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

/** POST /stable – sets the nvm `stable` alias via `nvm alias stable <version>`. */
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

/**
 * POST /aliases/lts – writes an LTS alias file directly to `~/.nvm/alias/lts/<codename>`.
 * Cannot use `nvm alias` for this because nvm rejects subdirectory alias writes.
 */
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

/** POST /uninstall – removes a Node.js version via `nvm uninstall`. */
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

/**
 * Built-in nvm aliases that must not be deleted.
 * The same set exists in `nvm.parser.ts` for the parser-level flags;
 * this copy enforces the restriction at the route layer.
 */
const PROTECTED_ALIASES = new Set(['default', 'node', 'stable', 'unstable', 'iojs']);

/** GET /aliases – returns all current nvm aliases. */
const getAliasesHandler: RequestHandler = async (_req, res, next) => {
  try {
    const { stdout, stderr } = await runNvm(['alias']);
    const aliases = parseAliases(stdout);
    res.json({ stdout, stderr, aliases });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /aliases – creates or updates a custom alias via `nvm alias <name> <target>`.
 * LTS aliases (`lts/*`) must use the dedicated `/aliases/lts` endpoint.
 */
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

/**
 * DELETE /aliases/:name – removes a custom alias via `nvm unalias`.
 * Built-in/protected aliases (`default`, `node`, `stable`, `unstable`, `iojs`)
 * are rejected with 400.
 */
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

/**
 * DELETE /aliases/lts/:codename – deletes an LTS alias file directly from
 * `~/.nvm/alias/lts/<codename>`. Cannot use `nvm unalias` for subdirectory aliases.
 */
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
