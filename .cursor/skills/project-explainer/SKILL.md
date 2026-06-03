---
name: project-explainer
description: >-
  Erklärt das nvm-manager Projekt im Detail: Architektur, Design-Entscheidungen,
  Angular-Komponenten, Express-Backend, Datenfluß und Sicherheitskonzept.
  Verwende diesen Skill wenn der Benutzer fragt: "wie funktioniert X?",
  "warum wurde das so gelöst?", "erkläre mir die Architektur", "was macht
  diese Komponente?", "wie kommuniziert Frontend mit Backend?", oder ähnliche
  Fragen zum Projektaufbau und Design-Entscheidungen.
---

# nvm-manager – Projekt-Erklärer

## Überblick

**nvm-manager** ist ein lokales Web-Dashboard zur Verwaltung von Node.js-Versionen via nvm.
Es ist ein vollständiger Monorepo mit drei Apps:

```
apps/
  api/   – Express REST-API (Port 3789, bindet NUR an 127.0.0.1)
  web/   – Angular 17+ SPA (Port 4200, proxyt /api → 3789)
  e2e/   – Playwright End-to-End-Tests
```

## Kern-Designprinzipien

### Warum Express + Angular statt einem vollständigen Framework?
nvm ist eine Shell-Funktion (kein Binary). Es kann nur über `bash -lc` aufgerufen werden.
Ein Express-Backend ist der minimale Wrapper, der Shell-Befehle sicher ausführen und
als REST-API exponieren kann. Angular bietet reaktive UI ohne Build-Overhead eines
größeren Full-Stack-Frameworks.

### Warum nur 127.0.0.1?
Das Backend führt Shell-Kommandos aus. Ein Bind an `0.0.0.0` würde es im lokalen
Netzwerk erreichbar machen – ein erhebliches Sicherheitsrisiko.

### Warum keine Datenbank?
nvm selbst ist die einzige Quelle der Wahrheit (Dateisystem unter `~/.nvm`).
Eine Datenbank würde Sync-Probleme erzeugen. Stattdessen fragt die API nvm
bei jedem Request live ab.

### Warum Angular Signals statt NgRx/Akita?
Die App hat überschaubaren State (aktive Version, Log, Modal-Status).
Signals (Angular 17+) reichen für diesen Scope und reduzieren Boilerplate erheblich.
Kein separates State-Management-Paket nötig.

## Referenzdokumentation

- Für Angular-Komponenten, Template-Struktur und Datenfluss:
  [angular-architecture.md](angular-architecture.md)

- Für Express-Server, nvm-Service, Routen-Logik und Sicherheit:
  [express-architecture.md](express-architecture.md)

## Antwort-Leitfaden

Wenn der Benutzer nach Architektur fragt:
1. Lies die relevante Referenzdatei (angular-architecture.md oder express-architecture.md)
2. Erkläre die konkrete Implementierung mit Datei- und Zeilenreferenzen
3. Erkläre immer das **Warum** (Design-Entscheidung), nicht nur das **Was**
4. Zeige Zusammenhänge zwischen Frontend und Backend wenn relevant
