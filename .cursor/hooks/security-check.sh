#!/bin/bash
# Security hook: warns about potentially dangerous shell commands in the nvm-manager project.
# Does not block automatically, but informs the agent.

input=$(cat)
command=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null || echo "")

# Patterns that would be unusual in the context of this project
DANGEROUS_PATTERNS="rm -rf|curl.*\|.*bash|wget.*\|.*sh|eval|sudo|chmod 777|> /etc|mkfs|dd if="

if echo "$command" | grep -qE "$DANGEROUS_PATTERNS"; then
  echo "{
    \"permission\": \"ask\",
    \"user_message\": \"This command could be potentially dangerous. Please review it carefully before proceeding.\",
    \"agent_message\": \"The command contains patterns that are unusual in the nvm-manager context. Verify this is intentional: ${command}\"
  }"
  exit 0
fi

echo '{ "permission": "allow" }'
exit 0
