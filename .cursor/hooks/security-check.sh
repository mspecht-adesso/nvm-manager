#!/bin/bash
# Security hook: Warnt vor potenziell gefährlichen Shell-Kommandos im nvm-manager-Projekt.
# Blockiert nicht automatisch, informiert aber den Agenten.

input=$(cat)
command=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null || echo "")

# Muster, die im Kontext dieses Projekts ungewöhnlich wären
DANGEROUS_PATTERNS="rm -rf|curl.*\|.*bash|wget.*\|.*sh|eval|sudo|chmod 777|> /etc|mkfs|dd if="

if echo "$command" | grep -qE "$DANGEROUS_PATTERNS"; then
  echo "{
    \"permission\": \"ask\",
    \"user_message\": \"Dieses Kommando könnte potenziell gefährlich sein. Bitte prüfen Sie es sorgfältig bevor Sie fortfahren.\",
    \"agent_message\": \"Das Kommando enthält Muster, die im nvm-manager-Kontext ungewöhnlich sind. Prüfe ob dies beabsichtigt ist: ${command}\"
  }"
  exit 0
fi

echo '{ "permission": "allow" }'
exit 0
