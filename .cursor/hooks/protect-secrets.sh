#!/bin/bash
# Secret-protection hook: runs on beforeReadFile.
# Asks for confirmation before the agent reads sensitive files (.env, keys, credentials).
# Security-critical project: prevents accidental exposure of secrets to the model context.

input=$(cat)
file=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('path') or d.get('file') or d.get('filePath') or '')" 2>/dev/null || echo "")

# Sensitive file patterns (basename or path)
SENSITIVE_PATTERNS="(^|/)\.env($|\.)|\.pem$|\.key$|(^|/)id_rsa|(^|/)id_ed25519|credentials|secrets?\.(json|ya?ml|txt)$|\.p12$|\.pfx$|\.keystore$"

if echo "$file" | grep -qiE "$SENSITIVE_PATTERNS"; then
  echo "{
    \"permission\": \"ask\",
    \"user_message\": \"The agent wants to read a potentially sensitive file (${file}). Confirm only if it does not contain secrets.\",
    \"agent_message\": \"Reading a sensitive file was flagged. Avoid loading secrets into context unless strictly necessary: ${file}\"
  }"
  exit 0
fi

echo '{ "permission": "allow" }'
exit 0
