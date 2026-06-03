# Express Architecture – nvm-manager

## Directory Structure

```
apps/api/src/
  server.ts              – Express app factory + entry point
  routes/
    nvm.routes.ts        – All /api/versions/* endpoints
  nvm/
    nvm.service.ts       – Shell execution (runNvm, runNvmLs, spawnNvm)
    nvm.parser.ts        – Parses nvm stdout into structured objects
    nvm.types.ts         – TypeScript types, NvmError class, validation functions
```

## server.ts – App Factory Pattern

```typescript
export function createApp(): Express { ... }

if (process.env['NODE_ENV'] !== 'test') {
  createApp().listen(3789, '127.0.0.1', () => { ... });
}
```

**Why a factory function?**
Vitest/Supertest tests import `createApp()` and receive a fresh instance
without side effects. The guard `NODE_ENV !== 'test'` prevents the server from
listening on port 3789 during test runs and blocking other tests.

**CORS:** Only `http://localhost:4201` is allowed (Angular dev server default).
In production both frontend and backend would share the same origin and CORS
would not be needed – but explicit allowance is required for local dev with proxy changes.

## nvm.service.ts – Shell Execution

### The nvm Shell Problem

nvm is **not an executable** (`/usr/local/bin/nvm`), but a **shell function**
defined in `~/.nvm/nvm.sh`. It can only be loaded and called inside a shell.

**Solution:** Every call spawns a new `bash -c` shell, sources nvm.sh and executes the command:

```typescript
const NVM_HEADER = `
  unset npm_config_prefix;
  unset NPM_CONFIG_PREFIX;
  export NVM_DIR="${NVM_DIR}";
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";
`;

execFile('bash', ['-c', NVM_HEADER + `nvm ${escapeArgs(args)}`], ...)
```

**Why `unset npm_config_prefix`?**
When the Express server runs under an nvm-managed Node version,
`npm_config_prefix` is set to the nvm directory. Without unsetting it,
`nvm use` fails with an `npm_config_prefix` conflict error.

### Shell Injection Protection

```typescript
function escapeArgs(args: string[]): string {
  return args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
}
```

Arguments are single-quote-escaped. **Additionally**, `nvm.types.ts` validates every
input value via whitelist regex before it even reaches `escapeArgs`.

### runNvm vs. runNvmLs vs. spawnNvm

| Function | Used for | Why |
|----------|----------|-----|
| `runNvm(args)` | All single commands (install, use, alias, ...) | Simple Promise, 3 min timeout |
| `runNvmLs()` | GET /versions/installed | Runs `nvm use default >/dev/null` first, then `nvm ls`. This ensures `->` always shows the correct active version regardless of which Node the Express server started with |
| `spawnNvm(args)` | SSE /versions/install/stream | Streaming for live output via Server-Sent Events |

**Why `runNvmLs` instead of simply `runNvm(['ls'])`?**
The Express process runs with a specific Node version. Calling `nvm ls` in that process
makes `->` point to the Express process's Node version, not the actual active default.
Running `nvm use default` before `nvm ls` corrects this.

## nvm.parser.ts – Output Parsing

nvm returns ANSI color codes in its output. All parsers begin with:
```typescript
const ANSI_ESCAPE = /\x1b\[[0-9;]*[a-zA-Z]/g;
line.replace(ANSI_ESCAPE, '')
```

### parseInstalledVersions
Recognises only real version lines (regex: `/^\s*(->)?\s*v\d+\.\d+\.\d+/`).
Alias lines like `default -> v22.11.0` are intentionally ignored.

### parseAliases
Parses `nvm alias` output. Distinguishes between:
- **editable/deletable:** user-defined aliases
- **readonly:** `node`, `stable`, `unstable`, `lts/*` (managed by nvm)
- **editable only:** `default` (can be set but not deleted)

### parseRemoteVersions
Parses `nvm ls-remote`. LTS information is inline in parentheses:
`v24.16.0   (Latest LTS: Krypton)` → `{ version: "24.16.0", lts: "Krypton" }`
Returns versions in descending order (`.reverse()` at the end).

## nvm.types.ts – Validation

Three whitelist validators prevent shell injection at the API level:

```typescript
// Allowed: node, stable, lts/*, 22, 22.11, 22.11.0
isValidVersionInput(v)  →  /^(node|stable|lts\/\*|\d+(\.\d+){0,2})$/

// Allowed: letters + digits + - + _
isValidAliasName(v)     →  /^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/

// Allowed: node, stable, unstable, lts/<codename>, vX.Y.Z
isValidAliasTarget(v)   →  /^(node|stable|unstable|lts\/[\w.*-]+|v?\d+(\.\d+){0,2})$/
```

## API Endpoints Overview

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/status | nvm version + NVM_DIR |
| GET | /api/versions/installed | Installed versions (via nvm ls) |
| GET | /api/versions/remote | Available versions (via nvm ls-remote) |
| GET | /api/versions/aliases | All aliases (via nvm alias) |
| GET | /api/versions/install/stream | SSE: live output of nvm install |
| POST | /api/versions/install | Install a version |
| POST | /api/versions/use | Switch active version (nvm alias default) |
| POST | /api/versions/default | Set default (nvm alias default) |
| POST | /api/versions/uninstall | Uninstall a version |
| POST | /api/versions/aliases | Create/overwrite an alias |
| DELETE | /api/versions/aliases/:name | Delete an alias |

**Why does `use` internally call `nvm alias default` instead of `nvm use`?**
`nvm use` only changes the active version in the current shell process. Since every
API call spawns a new bash subshell, that change would be lost immediately.
`nvm alias default` writes the preference permanently to `~/.nvm/alias/default` –
the correct version is automatically activated on the next shell start.

## Error Handling

`NvmError` extends `Error` with `stdout`/`stderr`:
```typescript
class NvmError extends Error {
  constructor(message: string, public stdout: string, public stderr: string) { ... }
}
```

The error middleware in `server.ts` returns the raw streams for `NvmError` so that
the frontend can display the full nvm output when needed.
