#!/bin/bash
# Lint reminder hook: provides lint check hints after TypeScript file changes.

input=$(cat)
file=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('path',''))" 2>/dev/null || echo "")

# Only for TypeScript files
if ! echo "$file" | grep -qE "\.ts$"; then
  echo '{ "additional_context": "" }'
  exit 0
fi

# Test files: Vitest-specific hints
if echo "$file" | grep -qE "\.spec\.ts$|\.test\.ts$"; then
  echo '{
    "additional_context": "Test file changed. Make sure: (1) describe/it labels are in English, (2) vi.mock() instead of manual stubbing, (3) afterEach/beforeEach cleans up mocks with vi.clearAllMocks()."
  }'
  exit 0
fi

# API files: backend lint hints
if echo "$file" | grep -q "apps/api/"; then
  echo '{
    "additional_context": "TypeScript file in API changed. Lint hints: no '\''any'\'', await all Promises or use void-casts (@typescript-eslint/no-floating-promises), explicit return types on public functions, no console.log in handlers."
  }'
  exit 0
fi

# Angular TypeScript files: frontend lint hints
if echo "$file" | grep -q "apps/web/" && echo "$file" | grep -qE "\.ts$"; then
  echo '{
    "additional_context": "Angular TypeScript file changed. Lint hints: standalone: true on components (@angular-eslint/prefer-standalone), Signals instead of BehaviorSubject, @if/@for instead of *ngIf/*ngFor, no any types in HttpClient calls. A11y: use LiveAnnouncer for dynamic announcements, cdkTrapFocus for modals, FocusMonitor to restore focus on close."
  }'
  exit 0
fi

# Angular HTML templates: a11y hints
if echo "$file" | grep -q "apps/web/" && echo "$file" | grep -qE "\.html$"; then
  echo '{
    "additional_context": "Angular HTML template changed. A11y checklist: (1) Buttons in table rows need [attr.aria-label] with version context. (2) Decorative SVGs need aria-hidden=\"true\" focusable=\"false\". (3) Tables need scope=\"col\" on <th> and aria-label on <table>. (4) Active rows: [attr.aria-current]=\"v.active ? '\''true'\'' : null\". (5) Dynamic content (loading/results/errors) needs aria-live region. (6) Modals: role=\"dialog\" + aria-modal + cdkTrapFocus + Escape key handler. (7) Focus ring never removed without replacement."
  }'
  exit 0
fi

echo '{ "additional_context": "" }'
exit 0
