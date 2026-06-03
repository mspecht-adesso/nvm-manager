# Angular-Architektur – nvm-manager

## Komponenten-Hierarchie (Atomic Design)

```
App (Root-Komponente)
├── AppHeaderComponent          – Titel, nvm-Version, globaler Status
├── StatusCardComponent         – nvm-Verbindungsstatus (GET /api/status)
├── ActionCardComponent         – Eingabe für "Installieren" / "Aktivieren"
├── InstalledVersionsCardComponent – Liste installierter Node-Versionen
├── AliasesCardComponent        – nvm-Alias-Verwaltung
├── RemoteVersionsCardComponent – Verfügbare Node-Versionen von nodejs.org
├── LogCardComponent            – Live-Aktivitätslog
└── InstallModalComponent       – Modale Fortschrittsanzeige für Aktionen

Atoms (wiederverwendbare Grundbausteine):
  └── SpinnerComponent, LoadingStateComponent

Molecules:
  └── CardComponent             – generischer Card-Wrapper mit Slot/ng-content
```

## State-Management mit Angular Signals

Die Root-Komponente `App` hält den gesamten applikationsweiten State:

```typescript
// apps/web/src/app/app.ts
readonly log = signal<LogEntry[]>([]);
readonly isLoading = signal(false);
readonly installedVersions = signal<InstalledNodeVersion[]>([]);
readonly installedLoading = signal(false);
readonly installModal = signal<InstallModalState>(null);
readonly aliasesRefreshTrigger = signal(0);

// Derived state
readonly activeVersion = computed(() =>
  this.installedVersions().find((v) => v.active)
);
```

**Warum in der Root-Komponente?**
Der State wird von mehreren Cards gleichzeitig gebraucht (z.B. `isLoading` blockiert
ActionCard und InstalledVersionsCard gleichzeitig). Lifting state up in die Root
verhindert prop-drilling über mehrere Ebenen und macht den Datenfluss explizit.

**Warum `aliasesRefreshTrigger`?**
`AliasesCardComponent` hat einen eigenen `NvmApiService`-Aufruf. Nach `useVersion()`
oder `setDefault()` in der Root muss die Alias-Liste neu geladen werden – ohne
die komplette App neu zu rendern. Ein inkrementiertes Signal triggert `ngOnChanges`
in der AliasesCard, die dann selbst neu lädt.

## Datenkommunikation: Input/Output-Kontrakt

Cards sind **reine Präsentationskomponenten** – sie empfangen Daten via `@Input()`
und emittieren Aktionen via `@Output()`:

```typescript
// InstalledVersionsCardComponent
@Input() versions: InstalledNodeVersion[] = [];
@Input() loading = false;
@Output() useVersion = new EventEmitter<string>();
@Output() refresh = new EventEmitter<void>();
```

Die eigentliche HTTP-Logik liegt ausschließlich in:
- `App` (Root): für Aktionen mit appweitem State-Impact
- `AliasesCardComponent`: eigenständig, da Alias-State lokal ist
- `RemoteVersionsCardComponent`: eigenständig (Remote-Daten sind unabhängig)

## NvmApiService

`apps/web/src/app/services/nvm-api.service.ts`

**Injectable mit `providedIn: 'root'`** → Singleton, kein explizites Bereitstellen
im AppModule nötig (es gibt keins – die App ist standalone).

Alle Methoden geben `Observable<T>` zurück mit `.pipe(catchError(...))`.
Der Error-Handler extrahiert `err.error?.error ?? err.message` – so kommt die
Fehlermeldung des Express-Backends direkt in der UI an.

**Proxy-Konfiguration:** `proxy.conf.json` leitet `/api` → `http://127.0.0.1:3789`
während `ng serve`. Im Production-Build wird kein Proxy benötigt, da API und Frontend
vom selben Origin ausgeliefert werden sollen.

## InstallModalComponent – Warum OnChanges?

Das Modal zeigt Fortschritt (running → success/error) und schließt sich nach 3 s
automatisch bei Erfolg. Der Timer wird über `ngOnChanges` auf `state` gesteuert:

```typescript
ngOnChanges(changes: SimpleChanges): void {
  if (changes['state']) {
    clearTimeout(this.autoCloseTimer);
    if (this.state?.phase === 'success') {
      this.autoCloseTimer = setTimeout(() => this.closed.emit(), 3000);
    }
  }
}
```

**Warum nicht ein Signal + effect()?**
`InstallModalState` ist ein diskriminiertes Union-Type (`null | { phase: ... }`).
`ngOnChanges` reagiert direkt auf Referenzänderungen des `@Input()`-Signals aus der
Root-Komponente und ist semantisch klarer als ein `effect()` für I/O-Management.

## App-Konfiguration (Standalone Bootstrap)

`apps/web/src/app/app.config.ts` konfiguriert:
- `provideHttpClient(withFetch())` – modernes fetch-API statt XMLHttpRequest
- `provideRouter(routes)` – Routing (aktuell nur eine Route, vorbereitet für Erweiterungen)

Es gibt kein `AppModule`. Angular 17 Standalone Components brauchen kein NgModule mehr.

## Komponenten-Besonderheiten

### StatusCardComponent
Pollt `GET /api/status` und zeigt nvm-Version + NVM_DIR.
Zeigt "nicht verbunden" wenn der Express-Server nicht läuft.

### RemoteVersionsCardComponent
Lädt `GET /api/versions/remote` (kann langsam sein – nodejs.org-Netzwerkanfrage).
Wird deshalb lazy geladen (erst bei User-Interaktion, nicht beim App-Start).

### AliasesCardComponent
Besitzt lokalen State für Inline-Editing von Aliases.
Nutzt `aliasesRefreshTrigger` als `@Input()` und ruft bei dessen Änderung
(via `ngOnChanges`) neu die API ab.

### LogCardComponent
Empfängt `LogEntry[]` und rendert sie als zeitgestempeltes Protokoll.
Maximale Einträge: 20 (begrenzt in `App.addLog()` via `.slice(0, 19)`).
