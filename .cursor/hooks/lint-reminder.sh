#!/bin/bash
# Lint-Reminder-Hook: Gibt nach TypeScript-Änderungen Hinweise zu Lint-Checks.

input=$(cat)
file=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('path',''))" 2>/dev/null || echo "")

# Nur bei TypeScript-Dateien
if ! echo "$file" | grep -qE "\.ts$"; then
  echo '{ "additional_context": "" }'
  exit 0
fi

# Test-Dateien: Vitest-spezifische Hinweise
if echo "$file" | grep -qE "\.spec\.ts$|\.test\.ts$"; then
  echo '{
    "additional_context": "Testdatei geändert. Stelle sicher: (1) describe/it-Texte sind auf Deutsch, (2) vi.mock() statt manuellem Stubbing, (3) afterEach/beforeEach räumt Mocks auf mit vi.clearAllMocks()."
  }'
  exit 0
fi

# API-Dateien: Backend-Lint-Hinweise
if echo "$file" | grep -q "apps/api/"; then
  echo '{
    "additional_context": "TypeScript-Datei im API geändert. Lint-Hinweise: Kein '\''any'\'', alle Promises awaiten oder void-casts verwenden (@typescript-eslint/no-floating-promises), explizite Rückgabetypen bei public functions, kein console.log in Handlern."
  }'
  exit 0
fi

# Angular-Dateien: Frontend-Lint-Hinweise
if echo "$file" | grep -q "apps/web/"; then
  echo '{
    "additional_context": "Angular TypeScript-Datei geändert. Lint-Hinweise: standalone: true bei Komponenten (@angular-eslint/prefer-standalone), Signals statt BehaviorSubject, @if/@for statt *ngIf/*ngFor, keine any-Typen in HttpClient-Aufrufen."
  }'
  exit 0
fi

echo '{ "additional_context": "" }'
exit 0
