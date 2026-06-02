import express from 'express';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import versionsRouter from './routes/nvm.routes.js';
import { runNvm } from './nvm/nvm.service.js';
import { NvmError } from './nvm/nvm.types.js';

const app = express();

app.use(express.json());
app.use(morgan('dev'));
app.use(
  cors({
    origin: 'http://localhost:4201',
  }),
);

const statusHandler: RequestHandler = async (_req, res, next) => {
  try {
    const nvmDir = process.env['NVM_DIR'] ?? `${process.env['HOME']}/.nvm`;
    const { stdout } = await runNvm(['--version']);
    res.json({
      ok: true,
      nvmVersion: stdout.trim(),
      nvmDir,
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

app.get('/api/status', statusHandler);
app.use('/api/versions', versionsRouter);

const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const isNvmError = err instanceof NvmError;
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Interner Fehler',
    stdout: isNvmError ? err.stdout : '',
    stderr: isNvmError ? err.stderr : '',
  });
};

app.use(errorMiddleware);

app.listen(3789, '127.0.0.1', () => {
  console.log('nvm manager api läuft auf http://127.0.0.1:3789');
});
