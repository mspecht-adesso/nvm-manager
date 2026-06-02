---
name: nodejs-express-expert
description: Expert-level Node.js and Express guidance for nvm-manager backend. Covers Express routing, middleware, typed request handlers, child process management for nvm commands, input validation, error handling, SSE streaming, and TypeScript configuration for apps/api/. Use when building API routes, executing nvm shell commands, handling errors, implementing streaming, or configuring the Express server.
---

# Node.js & Express Expert – nvm-manager

## Server-Setup (`server.ts`)

```typescript
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import versionsRouter from './routes/nvm.routes.js';

const app = express();

app.use(express.json());
app.use(morgan('dev'));
app.use(cors({ origin: 'http://localhost:4200' }));

app.use('/api/versions', versionsRouter);
app.use('/api', statusRouter);

// Error-Middleware – immer zuletzt
app.use(errorMiddleware);

app.listen(3789, '127.0.0.1', () =>
  console.log('nvm manager api läuft auf http://127.0.0.1:3789')
);
```

## Typed Request Handlers

```typescript
import { RequestHandler } from 'express';

export const installHandler: RequestHandler = async (req, res, next) => {
  try {
    const { version } = req.body as { version: unknown };
    if (!isValidVersionInput(version)) {
      res.status(400).json({ error: 'Ungültige Version: ' + String(version) });
      return;
    }
    const result = await nvmService.install(version);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
```

## nvm-Kommando-Ausführung

Zentrale Funktion in `nvm.service.ts`:

```typescript
import { execFile } from 'node:child_process';

const NVM_DIR = process.env.NVM_DIR ?? `${process.env.HOME}/.nvm`;

export function runNvm(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const escaped = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
    const cmd = `
      export NVM_DIR="${NVM_DIR}";
      [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";
      nvm ${escaped}
    `;
    execFile('bash', ['-lc', cmd],
      { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(new NvmError(error.message, stdout, stderr));
        else resolve({ stdout, stderr });
      }
    );
  });
}
```

## SSE-Streaming für lange Operationen (z.B. `nvm install`)

Für Echtzeit-Ausgabe während `nvm install`:

```typescript
export const installStreamHandler: RequestHandler = (req, res, next) => {
  const { version } = req.query as { version: unknown };
  if (!isValidVersionInput(version)) {
    res.status(400).end(); return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const cmd = buildNvmCommand(['install', version]);
  const child = spawn('bash', ['-lc', cmd]);

  child.stdout.on('data', (chunk: Buffer) =>
    res.write(`data: ${JSON.stringify({ type: 'stdout', line: chunk.toString() })}\n\n`)
  );
  child.stderr.on('data', (chunk: Buffer) =>
    res.write(`data: ${JSON.stringify({ type: 'stderr', line: chunk.toString() })}\n\n`)
  );
  child.on('close', code => {
    res.write(`data: ${JSON.stringify({ type: 'done', code })}\n\n`);
    res.end();
  });
  req.on('close', () => child.kill());
};
```

## Fehler-Middleware

```typescript
import { ErrorRequestHandler } from 'express';

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const isNvmError = err instanceof NvmError;
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Interner Fehler',
    stdout: isNvmError ? err.stdout : '',
    stderr: isNvmError ? err.stderr : '',
  });
};
```

## NvmError-Klasse

```typescript
export class NvmError extends Error {
  constructor(
    message: string,
    public readonly stdout: string,
    public readonly stderr: string,
  ) {
    super(message);
    this.name = 'NvmError';
  }
}
```

## Versions-Validierung

```typescript
const VERSION_RE = /^(node|stable|lts\/\*|\d+(\.\d+){0,2})$/;

export function isValidVersionInput(v: unknown): v is string {
  return typeof v === 'string' && VERSION_RE.test(v);
}
```

## tsconfig.json für API

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true
  }
}
```

## Nvm-Output parsen (`nvm.parser.ts`)

`nvm ls` gibt z.B. aus: `->     v22.11.0 (default)`

```typescript
export function parseInstalledVersions(stdout: string): InstalledNodeVersion[] {
  return stdout.split('\n')
    .filter(line => /v\d+\.\d+\.\d+/.test(line))
    .map(line => ({
      version: (line.match(/v(\d+\.\d+\.\d+)/) ?? [])[1] ?? '',
      active: line.includes('->'),
      default: line.includes('default'),
      system: line.includes('system'),
    }))
    .filter(v => v.version !== '');
}
```
