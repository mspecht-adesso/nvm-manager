---
name: formatting-linting-expert
description: Expert guidance for code formatting and linting in nvm-manager. Covers Prettier configuration, ESLint flat config for TypeScript and Angular, angular-eslint rules, EditorConfig, fixing lint errors, and setting up lint/format npm scripts. Use when setting up ESLint, Prettier, fixing lint errors, configuring angular-eslint, or adding format/lint scripts.
---

# Formatting & Linting Expert – nvm-manager

## Setup Workflow

### 1. Prettier (root level)

```bash
npm install --save-dev prettier
```

`.prettierrc` in root:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### 2. ESLint for API (`apps/api/`)

```bash
npm install --save-dev eslint typescript-eslint --prefix apps/api
```

`apps/api/eslint.config.mjs`:
```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  { ignores: ['dist/**', 'node_modules/**'] }
);
```

### 3. ESLint for Angular Web (`apps/web/`)

```bash
npm install --save-dev eslint typescript-eslint @angular-eslint/eslint-plugin @angular-eslint/eslint-plugin-template @angular-eslint/template-parser --prefix apps/web
```

`apps/web/eslint.config.mjs`:
```js
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/no-negated-async': 'warn',
      '@angular-eslint/template/click-events-have-key-events': 'warn',
    },
  },
  { ignores: ['.angular/**', 'node_modules/**', 'coverage/**'] }
);
```

## Common Lint Errors and Fixes

### `@typescript-eslint/no-floating-promises`
```typescript
// ❌ Error
this.nvmService.install(version);

// ✅ Fix: void or await
void this.nvmService.install(version);
// or
await this.nvmService.install(version);
```

### `@typescript-eslint/no-explicit-any`
```typescript
// ❌ Error
const body = req.body as any;

// ✅ Fix: unknown + type guard
const body = req.body as { version: unknown };
if (!isValidVersionInput(body.version)) { ... }
```

### `@angular-eslint/prefer-standalone`
```typescript
// ❌ Error: component without standalone: true
@Component({ selector: 'app-foo' })

// ✅ Fix
@Component({ selector: 'app-foo', standalone: true })
```

## Add Scripts

In `apps/api/package.json` and `apps/web/package.json`:
```json
"lint": "eslint src/",
"lint:fix": "eslint src/ --fix",
"format": "prettier --write src/",
"format:check": "prettier --check src/"
```

In root `package.json`:
```json
"lint": "npm run lint --prefix apps/api && npm run lint --prefix apps/web",
"format": "npm run format --prefix apps/api && npm run format --prefix apps/web",
"format:check": "npm run format:check --prefix apps/api && npm run format:check --prefix apps/web"
```

## VSCode/Cursor Settings (`.cursor/settings.json`)

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[html]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[scss]": { "editor.defaultFormatter": "esbenp.prettier-vscode" }
}
```
