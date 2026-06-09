# Findings Teil 3 – Neubewertung gegen Skills, Hooks & Rules

> Review vom 04.06.2026 · Bewertung des Gesamtprojekts (`apps/api/` + `apps/web/`)
> gegen die aktuell hinterlegten `.cursor/rules/`, `.cursor/hooks/` und `.cursor/skills/`.
> Aufbauend auf `sonnet-findings-01.md` und `sonnet-findings-02.md` (beide abgeschlossen).

---

## Legende

- `[ ]` – offen · `[x]` – erledigt
- Aufwand: **XS** < **S** < **M** < **L** < **XL**
- Severity: **Blocker** · **High** · **Medium** · **Low**

---

## Vorgehen (verifiziert, nicht angenommen)

Gemäß `definition-of-done`-Regel wurden die Gates real ausgeführt:

| Gate | Befehl | Ergebnis |
|------|--------|----------|
| API Build | `npm run build --prefix apps/api` | ❌ **schlägt fehl** (7 TS-Fehler) |
| API Lint | `npm run lint:api` | ✅ 0 Fehler |
| API Tests | `npm run test:api` | ✅ 144 grün |
| Web Build | `npm run build --prefix apps/web` | ✅ erfolgreich (356 kB initial) |
| Web Lint | `npm run lint:web` | ✅ 0 Fehler |
| Web Tests | `npm run test:web` | ❌ **5 von 200 rot** (`theme.service.spec.ts`) |

> Fazit vorab: Das Projekt erfüllt seine **eigene Definition of Done aktuell nicht** –
> sowohl der API-Build als auch die Web-Tests sind rot. Lint und das fachliche Verhalten
> (API-Tests, Web-Build) sind dagegen sauber.

---

## Tier 0 – Definition-of-Done-Blocker

### Schritt 1 – API-Build reparieren (`tsc` schlägt fehl)

**Aufwand:** S · **Severity:** Blocker

`npm run build --prefix apps/api` bricht mit 7 Fehlern ab. Zwei Ursachen:

**1a) Produktionscode-Typfehler in `parseInstalledVersions`**

```95:108:apps/api/src/nvm/nvm.parser.ts
export function parseInstalledVersions(stdout: string): InstalledNodeVersion[] {
  return stdout
    .split('\n')
    .map((line) => line.replace(ANSI_ESCAPE, ''))
    // Only real version lines: optional whitespace, optional "->", whitespace, then "vX.Y.Z"
    .filter((line) => /^\s*(->)?\s*v\d+\.\d+\.\d+/.test(line))
    .map((line) => ({
      version: (/v(\d+\.\d+\.\d+)/.exec(line) ?? [])[1] ?? '',
      active: line.trim().startsWith('->'),
      default: line.includes('(default)'),
      system: line.includes('system'),
    }))
    .filter((v) => v.version !== '');
}
```

Der Typ `InstalledNodeVersion` wurde inzwischen um `stable`, `unstable`, `iojs` erweitert
(`nvm.types.ts`), aber dieser Parser liefert die Felder nicht → `TS2322`.

- [ ] **Empfehlung: Funktion samt Spec entfernen.** `parseInstalledVersions` ist **toter Code** –
  die Route nutzt `runNvmLsFast()` (Dateisystem-basiert), die Funktion wird nirgends importiert
  außer in ihrer eigenen `nvm.parser.spec.ts`.
- [ ] Alternativ (falls bewusst aufgehoben): die drei fehlenden Felder ergänzen.

**1b) Spec-Dateien brechen den Build**

`apps/api/tsconfig.json` hat `include: ["src/**/*.ts"]` ohne Spec-Ausschluss – `tsc` kompiliert
also auch `*.spec.ts`. Dort schlagen veraltete Casts unter TS 6 / `@types/node` 25 fehl:

```
nvm.service.spec.ts(80,25): error TS2352: Conversion of type '[file, args, options, callback]'
to type '[string, string[]]' may be a mistake ...
```

- [ ] Specs aus dem Produktions-Build ausschließen: `"exclude": ["node_modules", "dist", "src/**/*.spec.ts"]`
- [ ] Die `as [string, string[]]`-Casts in `nvm.service.spec.ts` (Zeilen 80, 95, 168, 302, 310, 339)
  auf den korrekten `execFile`/`spawn`-Argumenttyp anpassen (z. B. `as unknown as [...]` oder
  echte Mock-Call-Auswertung)

> Hinweis: Die API-Tests laufen grün, weil Vitest via esbuild **ohne** Typprüfung transpiliert.
> Der `tsc`-Build deckt die Fehler auf – genau das, was die DoD verlangt.

---

### Schritt 2 – Web-Tests reparieren (`theme.service.spec.ts`, 5 rot)

**Aufwand:** S · **Severity:** Blocker

Alle 5 Fehlschläge betreffen `ThemeService`. Ursache ist **nicht** der Service, sondern eine
Umgebungs-Kollision: Das Projekt läuft unter **Node v25.9.0**. Node 25 bringt ein experimentelles
globales `localStorage` mit (Warnung im Testlauf: `` `--localstorage-file` was provided without a valid path ``).

Der Service liest direkt das globale `localStorage`:

```40:52:apps/web/src/app/services/theme.service.ts
  private resolveInitialTheme(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // ignore
    }
    ...
  }
```

Der Test mockt jedoch `Storage.prototype.getItem/setItem` (jsdom). Node 25s eingebautes
`localStorage` ist **keine** Instanz von jsdoms `Storage` → der Spy greift nicht, der Service
liest/schreibt die echte (datei-gestützte) Storage. Ergebnis: `expected 'light' to be 'dark'`
bzw. `expected undefined to be 'dark'`.

Lösungsoptionen (eine wählen):

- [ ] **Bevorzugt:** `localStorage`-Zugriff hinter einen injizierbaren Wrapper/Token legen
  (testbar, kein globaler Spy nötig) – passt zur DI-first-Konvention.
- [ ] Oder den Test auf `vi.stubGlobal('localStorage', mock)` umstellen (greift unabhängig von `Storage.prototype`).
- [ ] Oder die Node-Version auf eine LTS pinnen (siehe Schritt 5) – dann existiert kein globales `localStorage`.

---

## Tier 1 – Konfigurations- & Sicherheits-Drift

### Schritt 3 – CORS-Origin stimmt nicht mit der Regel überein

**Aufwand:** XS · **Severity:** Medium

`nvm-security` und `project-conventions` schreiben CORS **ausschließlich** für
`http://localhost:4200` vor. Der Server erlaubt jedoch `4201`:

```68:72:apps/api/src/server.ts
  app.use(
    cors({
      origin: 'http://localhost:4201',
    }),
  );
```

Der Angular-Dev-Server läuft auf dem Default-Port **4200** (kein Port-Override in `angular.json`).
Praktisch fällt das im Dev-Betrieb nicht auf, weil `proxy.conf.json` `/api` auf `127.0.0.1:3789`
proxyt (Same-Origin, kein CORS-Preflight) – die Regel wird aber dennoch verletzt und der Wert ist
faktisch tot/falsch.

- [ ] `origin` auf `http://localhost:4200` korrigieren (oder die Regel bewusst auf 4201 angleichen,
  falls der Port absichtlich geändert wurde)

---

### Schritt 4 – `nvm-security`-Whitelist ist veraltet (Doku-Drift)

**Aufwand:** S · **Severity:** Medium

Die Regel `nvm-security` listet als erlaubte Aktionen nur:
`--version`, `ls`, `ls-remote --lts`, `install`, `use`, `alias default`, `uninstall`
(„**No other command may be executed.**").

Die Implementierung führt inzwischen deutlich mehr aus (alle weiterhin validiert/escaped, aber
außerhalb der dokumentierten Whitelist):

- `nvm alias` (Liste), `nvm alias stable <v>`, `nvm alias <name> <target>`, `nvm unalias <name>`
- `nvm ls-remote` **ohne** `--lts` (`nvm.routes.ts` `getRemoteHandler`)
- Direkte Dateioperationen für LTS-Aliase (`setLtsAliasFile`/`deleteLtsAliasFile`)
- `git fetch`/`git checkout` im `NVM_DIR` (`updateNvm`)
- `open`/`xdg-open` auf das `NVM_DIR` (`openNvmDir`)

Das ist kein akutes Sicherheitsloch (Eingaben werden über `isValidVersionInput`,
`isValidAliasName`, `isValidAliasTarget`, `isValidLtsCodename` geprüft und single-quote-escaped),
aber die Regel beschreibt den Ist-Zustand nicht mehr.

- [ ] `nvm-security.mdc` um die tatsächlich erlaubten Aktionen (Aliase, `stable`, `ls-remote`,
  nvm-Update via git, Verzeichnis öffnen) erweitern, inkl. der jeweiligen Validierungsregex
- [ ] Validierungs-Asymmetrie dokumentieren/prüfen: `default` nutzt `isValidAliasTarget`
  (erlaubt `v?\d+...`, `unstable`, `lts/<codename>`), `install`/`use`/`uninstall` nutzen das
  strengere `isValidVersionInput` – beabsichtigt, aber erklärungswürdig

---

### Schritt 5 – Laufzeit auf eine LTS-Node-Version pinnen

**Aufwand:** XS · **Severity:** Medium

Build und Tests laufen unter **Node v25.9.0** (ungerade, kein LTS). Angular gibt explizit die
Warnung aus, dass ungerade Versionen nicht für Produktion verwendet werden sollen. Node 25 ist
zugleich die Wurzel von Schritt 2 (globales `localStorage`).

- [ ] `.nvmrc` mit einer LTS (z. B. `22`) im Repo-Root anlegen – passend zum „nvm-Manager"-Thema
- [ ] `"engines": { "node": ">=20 <23" }` in den `package.json` ergänzen
- [ ] CI/lokale Empfehlung in der README/Benutzerhandbuch ergänzen

---

## Tier 2 – Regel-Verstöße (klein, aber Regeln sind `alwaysApply`)

### Schritt 6 – Deutsche Code-Kommentare (`comments-english`)

**Aufwand:** XS · **Severity:** Low

Die Regel `comments-english` (`alwaysApply: true`) verlangt englische Code-Kommentare.
Verstöße:

```49:53:apps/api/src/routes/nvm.routes.ts
    // "Verwenden" setzt die Version nur aktiv, NICHT als Default.
    // nvm use validiert die Version und liefert "Now using node ...".
    // Da nvm use prozessgebunden ist, merken wir die aktive Version zusätzlich
    // als Override, damit GET /installed (und damit der Header) sie als aktiv
    // markiert. Der default-Alias bleibt unverändert.
```

- [ ] Obigen Block ins Englische übersetzen
- [ ] `apps/api/src/nvm/nvm.service.spec.ts:175` (`// Alias-Auflösung (über runNvmLsFast)`) übersetzen
- [ ] `apps/api/src/routes/nvm.routes.spec.ts:402` (deutscher Kommentar) übersetzen

---

### Schritt 7 – `@openapi`-Annotationen fehlen vollständig

**Aufwand:** M · **Severity:** Low

Sowohl die `definition-of-done`-Regel („new endpoints have `@openapi`") als auch der `stop`-Hook
(Punkt 2) und die `documentation-expert`-Skill erwarten OpenAPI-Annotationen an den Endpunkten.
Im gesamten `apps/`-Baum existiert **kein** `@openapi`/Swagger (per Suche bestätigt). Stattdessen
gibt es eine manuell gepflegte `desc/API.md`.

- [ ] Entscheidung treffen: Entweder `@openapi`-JSDoc + `swagger-ui-express` einführen
  (wie in der Skill beschrieben) …
- [ ] … **oder** die DoD-Regel/den Hook an die Realität anpassen (manuelle `API.md` als bewusster Ersatz)

> Konsistenz-Punkt: Aktuell weichen Regel/Hook/Skill vom Ist-Zustand ab – das untergräbt den
> Wert der automatischen `stop`-Hook-Prüfung.

---

## Tier 3 – Aufräumen / Codequalität

### Schritt 8 – Toter Code & verwaister TSDoc-Block in `nvm.parser.ts`

**Aufwand:** XS · **Severity:** Low

- [ ] `parseInstalledVersions` + zugehörige `describe`-Blöcke in `nvm.parser.spec.ts` entfernen
  (ersetzt durch `runNvmLsFast`; siehe Schritt 1a)
- [ ] Verwaisten/duplizierten TSDoc-Block bereinigen: In `nvm.parser.ts` beschreiben die Zeilen
  6–20 `parseInstalledVersions`, stehen aber unmittelbar über `parseAliases` – irreführend

---

## Was bereits sehr gut ist (keine Aktion nötig)

- **Shell-Injection-Schutz** ist mustergültig: zweischichtig (Whitelist-Regex in `nvm.types.ts`
  + Single-Quote-Escaping in `escapeArgs`), zusätzlich Defense-in-Depth-Check des
  GitHub-API-Tags in `updateNvm`.
- **Netzwerk-Bindung** korrekt: API lauscht ausschließlich auf `127.0.0.1:3789`.
- **Frontend** ist durchgängig standalone, signals-first, `OnPush`, zoneless, mit zentralem
  `httpErrorInterceptor` + `GlobalErrorHandler` und `rxResource`-Reads (Ergebnis aus Teil 1 & 2).
- **A11y**: Live-Regionen, Fokus-Management im Modal, Escape-Handling, Tabellen-Semantik vorhanden.
- **Express**: typisierte `RequestHandler`, try/catch + `next(err)`, zentrale Error-Middleware,
  `execFile` statt `exec`, `morgan` nur außerhalb von `test`.
- **Tests insgesamt** umfangreich (API 144, Web 195 grün) und gut platziert (Co-Location).

---

## Priorisierte Übersicht

| # | Schritt | Tier | Aufwand | Severity | Status |
|---|---------|------|---------|----------|--------|
| 1 | API-Build (`parseInstalledVersions` + Spec-Casts) | 0 | S | Blocker | offen |
| 2 | Web-Tests `theme.service` (Node-25-`localStorage`) | 0 | S | Blocker | offen |
| 3 | CORS-Origin 4201 → 4200 | 1 | XS | Medium | offen |
| 4 | `nvm-security`-Whitelist aktualisieren | 1 | S | Medium | offen |
| 5 | Node-LTS pinnen (`.nvmrc` + `engines`) | 1 | XS | Medium | offen |
| 6 | Deutsche Code-Kommentare übersetzen | 2 | XS | Low | offen |
| 7 | `@openapi` einführen **oder** Regel angleichen | 2 | M | Low | offen |
| 8 | Toten Code + TSDoc in `nvm.parser.ts` aufräumen | 3 | XS | Low | offen |

**Empfohlene Reihenfolge:** 1 → 2 (DoD wieder grün), dann 3 → 5 (Konfig/Sicherheit),
danach 4 → 6 → 8 (Doku/Sauberkeit), zuletzt 7 (Grundsatzentscheidung).
