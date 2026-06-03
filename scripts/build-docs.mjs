#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DIRS = ['docs', 'desc'];

const THEME_SCRIPT = `
  (function () {
    const stored = localStorage.getItem('nvm-docs-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
`;

const THEME_TOGGLE_JS = `
  function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('nvm-docs-theme', next);
    document.getElementById('theme-btn').textContent = next === 'dark' ? '☀️ Light' : '🌙 Dark';
  }
  document.addEventListener('DOMContentLoaded', function () {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.getElementById('theme-btn').textContent = isDark ? '☀️ Light' : '🌙 Dark';
  });
`;

const SHARED_CSS = `
  :root {
    --bg:        #ffffff;
    --bg-subtle: #f6f8fa;
    --border:    #d0d7de;
    --border-h:  #e6edf3;
    --text:      #24292f;
    --text-muted:#57606a;
    --link:      #0969da;
    --pre-bg:    #f6f8fa;
    --stripe:    #f6f8fa;
    --header-bg: #24292f;
    --header-fg: #e6edf3;
  }

  [data-theme="dark"] {
    --bg:        #0d1117;
    --bg-subtle: #161b22;
    --border:    #30363d;
    --border-h:  #30363d;
    --text:      #e6edf3;
    --text-muted:#8b949e;
    --link:      #58a6ff;
    --pre-bg:    #161b22;
    --stripe:    #161b22;
    --header-bg: #161b22;
    --header-fg: #e6edf3;
  }

  *, *::before, *::after { box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.7;
    color: var(--text);
    background: var(--bg);
    margin: 0;
    transition: background 0.2s, color 0.2s;
  }

  #theme-btn {
    position: fixed;
    top: 1rem;
    right: 1.25rem;
    z-index: 100;
    cursor: pointer;
    background: var(--bg-subtle);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 0.3em 0.85em;
    font-size: 0.82rem;
    font-family: inherit;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
  }

  #theme-btn:hover { opacity: 0.8; }
`;

const DOC_CSS = `
  body { padding: 2rem 1rem; }

  .content { max-width: 860px; margin: 0 auto; }

  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.3;
  }

  h1 { font-size: 2rem; border-bottom: 2px solid var(--border-h); padding-bottom: 0.4em; }
  h2 { font-size: 1.5rem; border-bottom: 1px solid var(--border-h); padding-bottom: 0.3em; }
  h3 { font-size: 1.2rem; }

  p { margin: 0.8em 0; }

  a { color: var(--link); text-decoration: none; }
  a:hover { text-decoration: underline; }

  code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.875em;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.15em 0.4em;
  }

  pre {
    background: var(--pre-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 1rem 1.25rem;
    overflow-x: auto;
    line-height: 1.5;
  }

  pre code { background: none; border: none; padding: 0; font-size: 0.85em; }

  blockquote {
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 4px solid var(--border);
    color: var(--text-muted);
    background: var(--bg-subtle);
    border-radius: 0 4px 4px 0;
  }

  table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.9em; }
  th, td { border: 1px solid var(--border); padding: 0.5em 0.75em; text-align: left; }
  th { background: var(--bg-subtle); font-weight: 600; }
  tr:nth-child(even) td { background: var(--stripe); }

  ul, ol { padding-left: 1.5em; margin: 0.5em 0; }
  li { margin: 0.25em 0; }

  hr { border: none; border-top: 1px solid var(--border-h); margin: 2em 0; }

  img { max-width: 100%; border-radius: 4px; }
`;

function htmlTemplate(title, body) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script>${THEME_SCRIPT}</script>
  <style>
${SHARED_CSS}
${DOC_CSS}
  </style>
</head>
<body>
  <button id="theme-btn" onclick="toggleTheme()"></button>
  <div class="content">
${body}
  </div>
  <script>${THEME_TOGGLE_JS}</script>
</body>
</html>`;
}

const DIR_LABELS = {
  docs: 'Dokumentation',
  desc: 'Projektbeschreibung',
};

function readFirstHeading(mdContent) {
  const match = mdContent.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

let converted = 0;
const index = [];

for (const dir of DIRS) {
  const absDir = join(ROOT, dir);
  const files = readdirSync(absDir).filter((f) => f.endsWith('.md'));
  const section = { dir, label: DIR_LABELS[dir] ?? dir, entries: [] };

  for (const file of files) {
    const mdPath = join(absDir, file);
    const htmlPath = join(absDir, basename(file, '.md') + '.html');

    const markdown = readFileSync(mdPath, 'utf-8');
    const body = marked(markdown);
    const stem = basename(file, '.md');
    const heading = readFirstHeading(markdown) ?? stem.replace(/[-_]/g, ' ');
    const html = htmlTemplate(heading, body);

    writeFileSync(htmlPath, html, 'utf-8');
    console.log(`✓  ${dir}/${stem}.html`);
    converted++;

    section.entries.push({ href: `${dir}/${stem}.html`, label: heading, stem });
  }

  index.push(section);
}

// --- index page ---

const CARD_ICONS = {
  docs: '📖',
  desc: '📐',
};

function indexPage(sections) {
  const cards = sections
    .map(({ dir, label, entries }) => {
      const icon = CARD_ICONS[dir] ?? '📄';
      const links = entries
        .map(
          ({ href, label }) =>
            `        <li><a href="${href}">${label}</a></li>`,
        )
        .join('\n');
      return `      <section class="card">
        <h2>${icon} ${label} <span class="badge">${dir}/</span></h2>
        <ul>
${links}
        </ul>
      </section>`;
    })
    .join('\n\n');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NVM Manager – Dokumentationsübersicht</title>
  <script>${THEME_SCRIPT}</script>
  <style>
${SHARED_CSS}

    body { line-height: 1.6; padding: 0; }

    header {
      background: var(--header-bg);
      color: var(--header-fg);
      padding: 2.5rem 1.5rem 2rem;
      text-align: center;
      transition: background 0.2s;
    }

    header h1 {
      margin: 0 0 0.35em;
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    header p { margin: 0; color: var(--text-muted); font-size: 1rem; }

    main {
      max-width: 900px;
      margin: 2.5rem auto;
      padding: 0 1.25rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 1.5rem;
    }

    .card {
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.5rem 1.75rem;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
      transition: background 0.2s, border-color 0.2s;
    }

    .card h2 {
      margin: 0 0 1rem;
      font-size: 1.1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .badge {
      margin-left: auto;
      font-size: 0.72rem;
      font-weight: 500;
      font-family: 'SFMono-Regular', Consolas, monospace;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: 20px;
      padding: 0.15em 0.6em;
    }

    ul { list-style: none; margin: 0; padding: 0; }

    li { border-top: 1px solid var(--border-h); padding: 0.45em 0; }
    li:first-child { border-top: none; }

    a { color: var(--link); text-decoration: none; font-size: 0.95rem; }
    a:hover { text-decoration: underline; }

    footer {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-muted);
      font-size: 0.82rem;
    }

    footer code {
      font-family: 'SFMono-Regular', Consolas, monospace;
      background: var(--bg-subtle);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.1em 0.4em;
    }
  </style>
</head>
<body>
  <button id="theme-btn" onclick="toggleTheme()"></button>

  <header>
    <h1>NVM Manager</h1>
    <p>Dokumentationsübersicht</p>
  </header>

  <main>
${cards}
  </main>

  <footer>Generiert von <code>npm run docs:build</code></footer>

  <script>${THEME_TOGGLE_JS}</script>
</body>
</html>`;
}

const indexHtml = indexPage(index);
writeFileSync(join(ROOT, 'docs.html'), indexHtml, 'utf-8');
console.log(`✓  docs.html (Übersichtsseite)`);

console.log(`\nDone — ${converted} file(s) converted.`);
