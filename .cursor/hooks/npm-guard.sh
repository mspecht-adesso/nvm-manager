#!/bin/bash
# npm-guard hook: enforces dependency management conventions before npm install/add/update.
# Blocks on "latest" tag usage; adds a reminder for all other package operations.

input=$(cat)
command=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null || echo "")

# Only act on npm install / add / update / i commands
if ! echo "$command" | grep -qE "npm (install|i |add |update |ci )"; then
  echo '{ "permission": "allow" }'
  exit 0
fi

# Block hard on @latest – this is a convention violation
if echo "$command" | grep -qE "@latest"; then
  echo '{
    "permission": "deny",
    "user_message": "npm @latest is not allowed. The project convention requires pinned caret ranges (e.g. ^5.2.1). Use: npm install <package>@<version> instead.",
    "agent_message": "Denied: \"latest\" version tag is forbidden by project conventions (project-conventions.mdc). Resolve the exact current version and use a caret range instead."
  }'
  exit 0
fi

# For all other package operations: allow but inject reminders
echo '{
  "permission": "allow",
  "agent_message": "npm package operation detected. After it completes: (1) Verify the added/updated package uses a caret range in package.json, not \"latest\". (2) Run knip to check for newly unused packages: npx knip. (3) Run npm audit to check for vulnerabilities. (4) Add a chore(deps) commit entry to CHANGELOG.md."
}'
exit 0
