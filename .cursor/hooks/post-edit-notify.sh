#!/bin/bash
# Post-edit hook: provides a type-check reminder after TypeScript file changes.

input=$(cat)
file=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('path',''))" 2>/dev/null || echo "")

# Only for TypeScript, HTML and SCSS files in the project
if echo "$file" | grep -qE "\.(ts|html|scss)$"; then
  # Check whether the file is in apps/api/ or apps/web/
  if echo "$file" | grep -q "apps/api/"; then
    echo "{
      \"additional_context\": \"File changed in API directory: ${file}. Make sure all TypeScript types are correct and no 'any' is used. Pay special attention to input validation if nvm commands are affected.\"
    }"
  elif echo "$file" | grep -q "apps/web/"; then
    echo "{
      \"additional_context\": \"File changed in Angular directory: ${file}. Make sure the standalone architecture is followed and Signals are used correctly.\"
    }"
  else
    echo '{ "additional_context": "" }'
  fi
else
  echo '{ "additional_context": "" }'
fi

exit 0
