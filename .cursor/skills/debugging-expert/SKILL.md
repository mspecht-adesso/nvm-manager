---
name: debugging-expert
description: Expert guidance for debugging the nvm-manager stack. Covers Angular Signals debugging with DevTools, tracing Express request/response cycles, analysing child_process stderr from nvm commands, diagnosing SSE streaming issues, and resolving the most common nvm runtime errors. Use when an error is unclear, when a Signal doesn't update as expected, when an nvm command silently fails, when SSE stops streaming, or when a test fails unexpectedly.
---

# Debugging Expert – nvm-manager

## 1. Angular Frontend Debugging

### Signals – Values Not Updating

Signals are pull-based: the template only re-reads when change detection runs.

```typescript
// Check 1: Is ChangeDetectionStrategy.OnPush set?
// With OnPush, only signal reads and async pipe trigger updates.

// Check 2: Are you mutating the signal value in place?
// ❌ Does NOT trigger update
this.versions().push(newVersion);

// ✅ Replace with new array
this.versions.update(v => [...v, newVersion]);

// Check 3: Is effect() running?
effect(() => {
  console.log('[debug] versions changed:', this.versions());
});
// Add temporarily to verify the signal fires.
```

### Angular DevTools

Open DevTools → Angular tab → Components tree:
- Click a component to inspect its **Signals** panel in real time
- **Profiler** tab: record a change-detection cycle to find which components re-render unexpectedly

### HTTP Errors

```typescript
// Temporarily bypass catchError to see the raw error:
this.http.get('/api/versions/installed').subscribe({
  next: v => console.log(v),
  error: e => console.error('[raw error]', e),
});
```

Browser → Network tab → filter `localhost:3789` to see raw HTTP responses.

---

## 2. Express Backend Debugging

### morgan – Request Tracing

`morgan('dev')` is registered in `server.ts`. Every request logs:
```
GET /api/versions/installed 200 12.345 ms - 348
```
If the request never appears, the proxy config (`proxy.conf.json`) is broken.

### child_process – nvm Command Failures

nvm errors arrive on **stderr**, not stdout. Always log both:

```typescript
try {
  const { stdout, stderr } = await runNvm(['ls']);
  if (stderr) console.warn('[nvm stderr]', stderr);
} catch (err) {
  // err.stdout and err.stderr available on NvmError
  console.error('[nvm error]', err);
}
```

**Common nvm stderr messages and causes:**

| Message | Cause | Fix |
|---------|-------|-----|
| `nvm: command not found` | NVM_DIR not sourced in bash subshell | Verify `source "$NVM_DIR/nvm.sh"` in nvm.service.ts |
| `N/A: version "x" is not yet installed` | Version string mismatch | Check version format (`v22.11.0` vs `22.11.0`) |
| `Version 'x' not found - try 'nvm ls-remote'` | Version doesn't exist | User input error or outdated remote list |
| Blank stdout, exit code 0 | nvm.sh sourcing failed silently | Print `NVM_DIR` env var in the spawned shell |

**Debug the subshell directly:**

```bash
# Run the exact command the backend would run:
bash -c 'source "$HOME/.nvm/nvm.sh" && nvm ls'
```

If this fails, the backend will too.

### Verifying NVM_DIR

```typescript
// Temporary log in nvm.service.ts
console.log('[nvm debug] NVM_DIR:', process.env.NVM_DIR);
console.log('[nvm debug] HOME:', process.env.HOME);
```

---

## 3. SSE Streaming Debugging

The install/uninstall endpoints emit Server-Sent Events.

### Test SSE with curl

```bash
curl -N http://127.0.0.1:3789/api/versions/install \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"version":"22"}'
```

Expected output: `data: {...}\n\n` lines streaming until `data: {"done":true}`.

### Angular EventSource

```typescript
// Temporarily log all SSE events:
const es = new EventSource('/api/versions/install');
es.onmessage = e => console.log('[sse]', e.data);
es.onerror   = e => console.error('[sse error]', e);
```

### SSE not streaming (buffering)

Check that the backend sets:
```typescript
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.flushHeaders(); // CRITICAL – sends headers immediately
```

If `res.flushHeaders()` is missing, the browser waits for the response to finish before showing anything.

---

## 4. Test Debugging

### Vitest – single test

```bash
cd apps/api && npx vitest run --reporter verbose src/nvm/nvm.parser.spec.ts
```

### Mock not applied

```typescript
// Common mistake: vi.mock() must be called BEFORE imports that use the module
vi.mock('../nvm/nvm.service.js'); // ← top of file, before describe()

// Check: is the mocked function actually being imported?
import * as nvmService from '../nvm/nvm.service.js';
console.log(nvmService.install.mock); // should exist if mock worked
```

### Supertest – port conflicts

`createApp()` returns the Express app without calling `listen()`.
If you see `EADDRINUSE`, a previous test leaked a real server:

```typescript
// ✅ Always use createApp(), never import the running server instance
import { createApp } from '../../server.js';
const app = createApp();
const res = await request(app).get('/api/status');
```

---

## 5. Quick Diagnostic Checklist

```
□ Backend running? → curl http://127.0.0.1:3789/api/status
□ Frontend proxy working? → Network tab in DevTools, check /api/* goes to port 3789
□ nvm available in subshell? → bash -c 'source ~/.nvm/nvm.sh && nvm --version'
□ NVM_DIR set? → echo $NVM_DIR (should be ~/.nvm)
□ Signal not updating? → Check OnPush + signal.set() vs mutation
□ SSE not streaming? → Check res.flushHeaders()
□ Test failing? → Check vi.mock() placement, createApp() usage
```
