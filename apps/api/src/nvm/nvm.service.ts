import { execFile, spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { NvmError } from './nvm.types.js';

const NVM_DIR = process.env['NVM_DIR'] ?? `${process.env['HOME']}/.nvm`;

/**
 * Baut den Shell-Befehl zum Laden von nvm und Ausführen eines nvm-Kommandos.
 * Argumente werden single-quote-escaped, um Shell-Injection zu verhindern.
 */
function buildNvmCommand(args: string[]): string {
  const escaped = args
    .map((a) => `'${a.replace(/'/g, "'\\''")}'`)
    .join(' ');

  return `
    export NVM_DIR="${NVM_DIR}";
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh";
    nvm ${escaped}
  `;
}

/**
 * Führt ein nvm-Kommando aus und gibt stdout/stderr zurück.
 * Timeout: 3 Minuten (für nvm install).
 */
export function runNvm(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const cmd = buildNvmCommand(args);

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
 * Startet ein nvm-Kommando als Streaming-Child-Process für SSE.
 * Wird für `nvm install` verwendet, um Live-Output zu liefern.
 */
export function spawnNvm(args: string[]): ChildProcess {
  const cmd = buildNvmCommand(args);
  return spawn('bash', ['-lc', cmd]);
}
