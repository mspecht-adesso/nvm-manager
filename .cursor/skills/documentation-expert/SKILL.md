---
name: documentation-expert
description: Expert guidance for writing technical documentation and a user manual for nvm-manager. Covers TSDoc/JSDoc comments for TypeScript code, OpenAPI/Swagger API documentation, generating API docs with swagger-ui-express, writing a Markdown user handbook, structuring README files, and documenting Angular components. Use when writing code comments, documenting API endpoints, creating a user manual, writing TSDoc, setting up Swagger, or improving the README.
---

# Documentation Expert – nvm-manager

## Two Types of Documentation

1. **Technical docs** – TSDoc comments in code, OpenAPI/Swagger for the REST API
2. **User handbook** – Markdown file for end users of the nvm-manager tool

---

## TSDoc Comments (TypeScript)

Standard for TypeScript projects. Only comment non-obvious functions:

```typescript
/**
 * Executes an nvm command in an isolated bash subshell.
 *
 * nvm is a shell function and must be sourced via `nvm.sh`
 * before each execution.
 *
 * @param args - Validated nvm arguments (e.g. `['install', '22']`)
 * @returns stdout and stderr of the nvm output
 * @throws {NvmError} when nvm returns a non-zero exit code
 *
 * @example
 * const { stdout } = await runNvm(['ls']);
 */
export async function runNvm(args: string[]): Promise<{ stdout: string; stderr: string }> { ... }

/**
 * Checks whether the input string is a valid nvm version specifier.
 *
 * Allowed formats: `node`, `stable`, `lts/*`, `22`, `22.11`, `22.11.0`
 *
 * @param v - Value to check (intentionally `unknown` for safe use in request handlers)
 */
export function isValidVersionInput(v: unknown): v is string { ... }
```

Document Angular services:

```typescript
/**
 * Service for communicating with the nvm-manager Express backend.
 *
 * All methods return Observables. Errors are handled via
 * `catchError` and are visible in `this.lastError`.
 */
@Injectable({ providedIn: 'root' })
export class NvmApiService { ... }
```

**Rules:**
- No obvious comments (`// increments the counter`)
- TSDoc on: public service methods, complex logic, non-trivial types
- Inline `//` comments for non-obvious implementation details

---

## OpenAPI / Swagger (Backend)

```bash
npm install swagger-ui-express swagger-jsdoc @types/swagger-ui-express @types/swagger-jsdoc --prefix apps/api
```

`apps/api/src/openapi.ts`:

```typescript
import swaggerJSDoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'nvm-manager API',
      version: '1.0.0',
      description: 'Local REST API for managing Node.js versions via nvm.',
    },
    servers: [{ url: 'http://127.0.0.1:3789' }],
  },
  apis: ['./src/routes/*.ts'],
});
```

Mount in `server.ts`:

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './openapi.js';

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

JSDoc annotations in routes:

```typescript
/**
 * @openapi
 * /api/versions/installed:
 *   get:
 *     summary: Lists all installed Node.js versions
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 versions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InstalledNodeVersion'
 *                 stdout:
 *                   type: string
 *                 stderr:
 *                   type: string
 * @openapi
 * components:
 *   schemas:
 *     InstalledNodeVersion:
 *       type: object
 *       properties:
 *         version:
 *           type: string
 *           example: "22.11.0"
 *         active:
 *           type: boolean
 *         default:
 *           type: boolean
 *         system:
 *           type: boolean
 */
router.get('/installed', getInstalledHandler);
```

Result: interactive API docs at `http://127.0.0.1:3789/api/docs`

---

## User Handbook (`docs/BENUTZERHANDBUCH.md`)

Create `docs/BENUTZERHANDBUCH.md` in the project root:

```markdown
# nvm Manager – User Handbook

## What is nvm Manager?

nvm Manager is a local web tool for macOS and Linux that allows managing
Node.js versions via nvm (Node Version Manager) through a browser interface.

## Prerequisites

- macOS or Linux
- [nvm](https://github.com/nvm-sh/nvm) installed (`nvm --version` returns a version)
- Node.js ≥ 18 and npm installed

## Getting Started

1. In the project folder: `npm install && npm run dev`
2. Open browser: [http://localhost:4200](http://localhost:4200)

## Features

### Check Status
...

### Install Version
...

### Note on `nvm use`
`nvm use` only applies to the shell session of the backend process...
```

Full handbook structure:
- Introduction + What is nvm Manager?
- Prerequisites and installation
- Step-by-step quickstart
- Each feature with screenshot placeholder and description
- Common errors and solutions (FAQ)
- Security notes
- Known limitations (`nvm use` limitation)

---

## Documentation Generation

Optional setup for automatic TypeScript API docs with TypeDoc:

```bash
npm install --save-dev typedoc --prefix apps/api
```

`apps/api/typedoc.json`:
```json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs",
  "excludePrivate": true,
  "plugin": []
}
```

Script: `"docs": "typedoc"`

---

## Further Resources

- For API endpoints: `http://127.0.0.1:3789/api/docs` (Swagger UI, after setup)
- For TypeScript types: `apps/api/src/nvm/nvm.types.ts` and `apps/web/src/app/models/nvm.models.ts`
