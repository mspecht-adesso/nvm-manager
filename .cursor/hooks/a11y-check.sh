#!/bin/bash
# a11y-check hook: static a11y pattern scan after HTML template edits.
# Runs lightweight grep-based checks; not a replacement for axe/Playwright audit.

input=$(cat)
file=$(echo "$input" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('path',''))" 2>/dev/null || echo "")

# Only Angular HTML templates
if ! echo "$file" | grep -qE "apps/web/.*\.html$"; then
  echo '{ "additional_context": "" }'
  exit 0
fi

if [ ! -f "$file" ]; then
  echo '{ "additional_context": "" }'
  exit 0
fi

issues=""

# 1. <button> without accessible name (no aria-label, no text content visible check is limited – flag buttons in loops)
if grep -qE '<button[^>]*\(click\)="(useVersion|uninstallVersion|install|use)\.' "$file"; then
  if ! grep -qE 'aria-label|aria-labelledby' "$file"; then
    issues="${issues}\n- Row-level action buttons detected but no aria-label found. Add [attr.aria-label] to disambiguate buttons per row."
  fi
fi

# 2. Decorative SVG without aria-hidden
if grep -q '<svg' "$file"; then
  if ! grep -qE 'aria-hidden="true"' "$file"; then
    issues="${issues}\n- SVG elements found without aria-hidden=\"true\". Decorative SVGs must have aria-hidden=\"true\" focusable=\"false\"."
  fi
fi

# 3. <table> without aria-label or caption
if grep -q '<table' "$file"; then
  if ! grep -qE 'aria-label|<caption' "$file"; then
    issues="${issues}\n- Table found without aria-label attribute or <caption>. Add aria-label=\"...\" to the <table> element."
  fi
fi

# 4. <th> without scope attribute
if grep -q '<th' "$file" && ! grep -qE '<th[^>]*scope=' "$file"; then
  issues="${issues}\n- Table headers (<th>) found without scope=\"col\" or scope=\"row\" attribute."
fi

# 5. Modal without cdkTrapFocus
if grep -qE 'role="dialog"' "$file"; then
  if ! grep -q 'cdkTrapFocus' "$file"; then
    issues="${issues}\n- Dialog element found without cdkTrapFocus. Add cdkTrapFocus and cdkTrapFocusAutoCapture (Angular CDK A11yModule)."
  fi
  if ! grep -qE 'aria-describedby' "$file"; then
    issues="${issues}\n- Dialog missing aria-describedby. Point it to the body paragraph id."
  fi
fi

# 6. aria-live / live region for dynamic content
if grep -qE '@if \(isLoading\(\)\)|@if \(loading\(\)\)' "$file"; then
  if ! grep -qE 'aria-live|role="status"|role="alert"' "$file"; then
    issues="${issues}\n- Loading state found but no aria-live region detected. Wrap loading/result messages in an aria-live=\"polite\" container."
  fi
fi

# 7. Error display without role=alert
if grep -qE 'errorMessage\(\)|error\(\)' "$file"; then
  if ! grep -qE 'role="alert"|aria-live="assertive"' "$file"; then
    issues="${issues}\n- Error message signal used but no role=\"alert\" or aria-live=\"assertive\" region found."
  fi
fi

if [ -n "$issues" ]; then
  msg=$(printf "A11y static scan found potential issues in %s:%b\nReview against WCAG 2.1 AA. Use the a11y-expert skill for patterns." "$file" "$issues")
  echo "{\"additional_context\": $(echo "$msg" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")}"
else
  echo '{ "additional_context": "" }'
fi

exit 0
