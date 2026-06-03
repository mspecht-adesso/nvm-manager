---
name: project-explainer
description: >-
  Explains the nvm-manager project in detail: architecture, design decisions,
  Angular components, Express backend, data flow and security concept.
  Use this skill when the user asks: "how does X work?",
  "why was it built this way?", "explain the architecture", "what does
  this component do?", "how does the frontend communicate with the backend?",
  or similar questions about project structure and design decisions.
---

# nvm-manager – Project Explainer

## Overview

**nvm-manager** is a local web dashboard for managing Node.js versions via nvm.
It is a complete monorepo with three apps:

```
apps/
  api/   – Express REST API (port 3789, binds to 127.0.0.1 ONLY)
  web/   – Angular 17+ SPA (port 4200, proxies /api → 3789)
  e2e/   – Playwright end-to-end tests
```

## Core Design Principles

### Why Express + Angular instead of a full framework?
nvm is a shell function (not a binary). It can only be invoked via `bash -c`.
An Express backend is the minimal wrapper that can safely execute shell commands and
expose them as a REST API. Angular provides a reactive UI without the build overhead of
a larger full-stack framework.

### Why only 127.0.0.1?
The backend executes shell commands. Binding to `0.0.0.0` would make it reachable on
the local network – a significant security risk.

### Why no database?
nvm itself is the single source of truth (filesystem under `~/.nvm`).
A database would introduce sync problems. Instead, the API queries nvm live on every request.

### Why Angular Signals instead of NgRx/Akita?
The app has manageable state (active version, log, modal status).
Signals (Angular 17+) are sufficient for this scope and reduce boilerplate significantly.
No separate state management package needed.

## Reference Documentation

- For Angular components, template structure and data flow:
  [angular-architecture.md](angular-architecture.md)

- For Express server, nvm service, route logic and security:
  [express-architecture.md](express-architecture.md)

## Response Guide

When the user asks about architecture:
1. Read the relevant reference file (angular-architecture.md or express-architecture.md)
2. Explain the concrete implementation with file and line references
3. Always explain the **why** (design decision), not just the **what**
4. Show connections between frontend and backend when relevant
