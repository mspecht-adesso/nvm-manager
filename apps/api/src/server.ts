/**
 * Express application factory and entry point.
 *
 * `createApp()` builds and returns a fully configured Express instance so that
 * tests can import and instantiate it without starting a real TCP server.
 * The server only starts listening when `NODE_ENV` is not `"test"`.
 *
 * Bound address: `127.0.0.1:3789` – never `0.0.0.0`, to prevent accidental
 * network exposure of the shell-command API.
 *
 * Middleware stack (in order):
 *   1. `express.json()` – parses JSON request bodies
 *   2. `morgan('dev')` – HTTP access logging (skipped in test mode)
 *   3. `cors` – allows requests from `http://localhost:4201` only
 *   4. Route handlers (see below)
 *   5. Central error middleware – converts errors to JSON 500 responses
 *
 * Top-level routes defined here (not in the router):
 *   - `GET  /api/status`       – nvm version + update availability
 *   - `POST /api/nvm/update`   – git-based nvm self-update
 *   - `POST /api/nvm/open-dir` – opens NVM_DIR in the native file manager
 */
import express from 'express';
import type { ErrorRequestHandler, RequestHandler, Express } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import versionsRouter from './routes/nvm.routes.js';
import { runNvm, updateNvm, fetchNvmLatestVersion, openNvmDir } from './nvm/nvm.service.js';
import { NvmError } from './nvm/nvm.types.js';

/**
 * GET /api/status – returns the current nvm installation state.
 *
 * Runs `nvm --version` and, in parallel, queries the GitHub Releases API for
 * the latest nvm release. The GitHub query is best-effort: `nvmLatestVersion`
 * is omitted from the response if it cannot be fetched.
 * When nvm is not installed / not sourced, the response is still HTTP 200 but
 * with `{ ok: false, error: "…" }` so the frontend can surface the issue.
 */
const statusHandler: RequestHandler = async (_req, res, next) => {
  try {
    const nvmDir = process.env['NVM_DIR'] ?? `${process.env['HOME']}/.nvm`;
    const [{ stdout }, nvmLatestVersion] = await Promise.all([
      runNvm(['--version']),
      fetchNvmLatestVersion(),
    ]);
    res.json({
      ok: true,
      nvmVersion: stdout.trim(),
      nvmDir,
      ...(nvmLatestVersion ? { nvmLatestVersion } : {}),
    });
  } catch (err) {
    if (err instanceof NvmError) {
      res.json({
        ok: false,
        error: err.message,
      });
      return;
    }
    next(err);
  }
};

/**
 * POST /api/nvm/update – performs a git-based nvm self-update.
 * Delegates to `updateNvm()` and forwards any error to the error middleware.
 */
const nvmUpdateHandler: RequestHandler = async (_req, res, next) => {
  try {
    const result = await updateNvm();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/nvm/open-dir – opens the NVM_DIR directory in the native file manager.
 * Returns `{ ok: true }` on success; errors are forwarded to the middleware.
 */
const openDirHandler: RequestHandler = async (_req, res, next) => {
  try {
    await openNvmDir();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/**
 * Central error middleware – converts any unhandled error into a JSON 500 response.
 *
 * Attaches `stdout`/`stderr` from `NvmError` instances so the frontend can
 * display raw nvm output alongside the human-readable error message.
 */
const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const isNvmError = err instanceof NvmError;
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Interner Fehler',
    stdout: isNvmError ? err.stdout : '',
    stderr: isNvmError ? err.stderr : '',
  });
};

/**
 * Creates and configures the Express application.
 *
 * Calling this function does NOT start a TCP server – it only builds the app
 * object. This separation allows tests to import the app with `createApp()`
 * and pass it directly to `supertest` without a live port.
 *
 * @returns The fully configured Express instance.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());
  if (process.env['NODE_ENV'] !== 'test') {
    app.use(morgan('dev'));
  }
  app.use(
    cors({
      origin: 'http://localhost:4201',
    }),
  );

  app.get('/api/status', statusHandler);
  app.post('/api/nvm/update', nvmUpdateHandler);
  app.post('/api/nvm/open-dir', openDirHandler);
  app.use('/api/versions', versionsRouter);
  app.use(errorMiddleware);

  return app;
}

if (process.env['NODE_ENV'] !== 'test') {
  createApp().listen(3789, '127.0.0.1', () => {
    console.log('nvm manager api läuft auf http://127.0.0.1:3789');
  });
}
