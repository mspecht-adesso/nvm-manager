import { execFile, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { NvmError } from './nvm.types.js';

const NVM_DIR = process.env['NVM_DIR'] ?? `${process.env['HOME']}/.nvm`;

/**
 * Gemeinsamer Shell-Header: setzt NVM_DIR und lädt nvm.sh.
 * Argumente werden single-quote-escaped, um Shell-Injection zu verhindern.
 */
const NVM_HEADER = `
  unset npm_config_prefix;
  unset NPM_CONFIG_PREFIX;
  export NVM_DIR="${NVM_DIR}";
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";
`;

function escapeArgs(args: string[]): string {
  return args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
}

/**
 * Führt ein einzelnes nvm-Kommando aus und gibt stdout/stderr zurück.
 * Timeout: 3 Minuten (für nvm install).
 */
export function runNvm(args: string[]): Promise<{ stdout: string; stderr: string }> {
  const cmd = NVM_HEADER + `nvm ${escapeArgs(args)}`;

  return new Promise((resolve, reject) => {
    execFile(
      'bash',
      ['-lc', cmd],
      { timeout: 180_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new NvmError(error.message, stdout, stderr));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

/**
 * Führt `nvm use default` aus, um die persistente Default-Version im
 * aktuellen Child-Prozess zu aktivieren, und liefert danach `nvm ls`.
 *
 * So zeigt `nvm ls` die korrekte aktive Version (->), unabhängig davon,
 * mit welcher Node-Version der Express-Server gestartet wurde.
 * `nvm use default` wird unterdrückt (>/dev/null), damit nur die
 * `nvm ls` Ausgabe zurückkommt und der Parser nicht verwirrt wird.
 */
export function runNvmLs(): Promise<{ stdout: string; stderr: string }> {
  const cmd = NVM_HEADER + `
    nvm use default > /dev/null 2>&1 || true;
    nvm ls
  `;

  return new Promise((resolve, reject) => {
    execFile(
      'bash',
      ['-lc', cmd],
      { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new NvmError(error.message, stdout, stderr));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

/**
 * Startet ein nvm-Kommando als Streaming-Child-Process für SSE.
 * Wird für `nvm install` verwendet, um Live-Output zu liefern.
 */
export function spawnNvm(args: string[]): ChildProcess {
  const cmd = NVM_HEADER + `nvm ${escapeArgs(args)}`;
  return spawn('bash', ['-lc', cmd]);
}
