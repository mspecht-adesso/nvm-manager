#!/bin/bash
# Post-edit hook: Gibt nach TypeScript-Datei-Änderungen einen Hinweis zur Typ-Prüfung aus.

input=$(cat)
file=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('path',''))" 2>/dev/null || echo "")

# Nur bei TypeScript-Dateien im Projekt
if echo "$file" | grep -qE "\.(ts|html|scss)$"; then
  # Prüfe ob in apps/api/ oder apps/web/
  if echo "$file" | grep -q "apps/api/"; then
    echo "{
      \"additional_context\": \"Datei im API-Verzeichnis geändert: ${file}. Stelle sicher dass alle TypeScript-Typen korrekt sind und kein 'any' verwendet wird. Prüfe insbesondere die Input-Validierung falls nvm-Kommandos betroffen sind.\"
    }"
  elif echo "$file" | grep -q "apps/web/"; then
    echo "{
      \"additional_context\": \"Datei im Angular-Verzeichnis geändert: ${file}. Stelle sicher dass Standalone-Architektur eingehalten wird und Signals korrekt verwendet werden.\"
    }"
  else
    echo '{ "additional_context": "" }'
  fi
else
  echo '{ "additional_context": "" }'
fi

exit 0
