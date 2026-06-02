---
name: documentation-expert
description: Expert guidance for writing technical documentation and a user manual for nvm-manager. Covers TSDoc/JSDoc comments for TypeScript code, OpenAPI/Swagger API documentation, generating API docs with swagger-ui-express, writing a Markdown user handbook, structuring README files, and documenting Angular components. Use when writing code comments, documenting API endpoints, creating a user manual, writing TSDoc, setting up Swagger, or improving the README.
---

# Documentation Expert – nvm-manager

## Zwei Dokumentations-Arten

1. **Technische Doku** – TSDoc-Kommentare im Code, OpenAPI/Swagger für die REST-API
2. **Benutzerhandbuch** – Markdown-Datei für Endanwender des nvm-manager-Tools

---

## TSDoc-Kommentare (TypeScript)

Standard für TypeScript-Projekte. Nur bei nicht-offensichtlichen Funktionen kommentieren:

```typescript
/**
 * Führt einen nvm-Befehl in einer isolierten bash-Subshell aus.
 *
 * nvm ist eine Shell-Funktion und muss vor jeder Ausführung
 * über `nvm.sh` geladen werden.
 *
 * @param args - Validierte nvm-Argumente (z.B. `['install', '22']`)
 * @returns Stdout und Stderr der nvm-Ausgabe
 * @throws {NvmError} wenn nvm einen Nicht-Null Exit-Code zurückgibt
 *
 * @example
 * const { stdout } = await runNvm(['ls']);
 */
export async function runNvm(args: string[]): Promise<{ stdout: string; stderr: string }> { ... }

/**
 * Prüft ob der Eingabe-String eine gültige nvm-Versionsangabe ist.
 *
 * Erlaubte Formate: `node`, `stable`, `lts/*`, `22`, `22.11`, `22.11.0`
 *
 * @param v - Zu prüfender Wert (bewusst `unknown` für sichere Verwendung in Request-Handlern)
 */
export function isValidVersionInput(v: unknown): v is string { ... }
```

Angular-Services dokumentieren:

```typescript
/**
 * Service für die Kommunikation mit dem nvm-manager Express-Backend.
 *
 * Alle Methoden geben Observables zurück. Fehler werden über
 * `catchError` behandelt und sind in `this.lastError` sichtbar.
 */
@Injectable({ providedIn: 'root' })
export class NvmApiService { ... }
```

**Regeln:**
- Keine offensichtlichen Kommentare (`// incrementiert den Zähler`)
- TSDoc bei: öffentlichen Service-Methoden, komplexer Logik, nicht-trivialen Typen
- Inline-Kommentare `//` für nicht-offensichtliche Implementierungsdetails

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
      description: 'Lokale REST-API zur Verwaltung von Node.js-Versionen via nvm.',
    },
    servers: [{ url: 'http://127.0.0.1:3789' }],
  },
  apis: ['./src/routes/*.ts'],
});
```

In `server.ts` einbinden:

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './openapi.js';

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

JSDoc-Annotationen in Routes:

```typescript
/**
 * @openapi
 * /api/versions/installed:
 *   get:
 *     summary: Listet alle installierten Node.js-Versionen
 *     responses:
 *       200:
 *         description: Erfolgreich
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

Ergebnis: Interaktive API-Doku unter `http://127.0.0.1:3789/api/docs`

---

## Benutzerhandbuch (`docs/BENUTZERHANDBUCH.md`)

Erstelle `docs/BENUTZERHANDBUCH.md` im Projekt-Root:

```markdown
# nvm Manager – Benutzerhandbuch

## Was ist nvm Manager?

nvm Manager ist ein lokales Web-Tool für macOS und Linux, das die Verwaltung von
Node.js-Versionen über nvm (Node Version Manager) per Browser-Oberfläche ermöglicht.

## Voraussetzungen

- macOS oder Linux
- [nvm](https://github.com/nvm-sh/nvm) installiert (`nvm --version` gibt eine Version aus)
- Node.js ≥ 18 und npm installiert

## Start

1. Im Projektordner: `npm install && npm run dev`
2. Browser öffnen: [http://localhost:4200](http://localhost:4200)

## Funktionen

### Status prüfen
...

### Version installieren
...

### Hinweis zu `nvm use`
`nvm use` gilt nur für die Shell-Session des Backend-Prozesses...
```

Vollständige Struktur des Handbuchs:
- Einleitung + Was ist nvm Manager?
- Voraussetzungen und Installation
- Schritt-für-Schritt Quickstart
- Jede Funktion mit Screenshot-Platzhalter und Beschreibung
- Häufige Fehler und Lösungen (FAQ)
- Sicherheitshinweise
- Bekannte Einschränkungen (`nvm use`-Limitation)

---

## Dokumentations-Generierung

Optionales Setup für automatische TypeScript-API-Docs mit TypeDoc:

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

## Weitere Ressourcen

- Für API-Endpunkte: `http://127.0.0.1:3789/api/docs` (Swagger UI, nach Setup)
- Für TypeScript-Typen: `apps/api/src/nvm/nvm.types.ts` und `apps/web/src/app/models/nvm.models.ts`
