import fs from 'fs';
import path from 'path';
import pino from 'pino';
import * as rfs from 'rotating-file-stream';

type RotationPolicy = 'size' | 'daily';

const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), 'server', 'logs');
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as pino.LevelWithSilent;
const LOG_TO_FILE = (process.env.LOG_TO_FILE || 'true').toLowerCase() === 'true';
const LOG_PRETTY = (process.env.LOG_PRETTY || (process.env.NODE_ENV !== 'production' ? 'true' : 'false')).toLowerCase() === 'true';
const LOG_ROTATION = (process.env.LOG_ROTATION || 'size') as RotationPolicy;
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || '10M'; // e.g., 10M, 50M
const LOG_MAX_FILES = parseInt(process.env.LOG_MAX_FILES || '14', 10);

let fileStream: any | undefined;
let logger: pino.Logger | undefined;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function getLogDir() {
  ensureLogDir();
  return LOG_DIR;
}

export function getLogger(): pino.Logger {
  if (logger) return logger;

  ensureLogDir();

  // Setup rotating file stream if enabled
  if (LOG_TO_FILE) {
    const generator = (time?: Date, index?: number) => {
      if (!time) return 'app.log';
      const day = time.toISOString().slice(0, 10);
      const idx = index ? `.${index}` : '';
      return `app-${day}${idx}.log`;
    };

    const createRotatingStream: any = (rfs as any).createStream || (rfs as any).default?.createStream || (rfs as any).default;

    if (typeof createRotatingStream === 'function') {
      const opts: any = {
        path: LOG_DIR,
        compress: 'gzip',
        maxFiles: LOG_MAX_FILES,
      };
      if (LOG_ROTATION === 'size') {
        opts.size = LOG_MAX_SIZE; // e.g., '10M'
      } else if (LOG_ROTATION === 'daily') {
        opts.interval = '1d';
      }
      fileStream = createRotatingStream(generator as any, opts);
    } else {
      // Fallback: non-rotating file (should rarely happen)
      const basePath = path.join(LOG_DIR, 'app.log');
      fileStream = fs.createWriteStream(basePath, { flags: 'a' });
    }
  }

  logger = pino(
    {
      level: LOG_LEVEL,
      redact: {
        paths: ['req.headers.authorization', 'password', 'token', 'apikey', 'apiKey', 'Authorization', 'authorization', 'secret'],
        remove: true,
      },
      base: { pid: process.pid },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    (fileStream as any) // write to rotating file stream; stdout mirrored by console patch
  );

  return logger;
}

export function closeLogger() {
  if (fileStream) {
    try { fileStream.end(); } catch {}
  }
}

// Force an immediate rotation of the current log file, ensuring the next write goes to a new file.
// Returns the name of the rotated file if provided by the stream implementation.
export async function rotateLogsNow(): Promise<{ rotatedFile?: string }> {
  if (!fileStream || typeof fileStream.rotate !== 'function') {
    // Rotation not available; best-effort no-op
    return {};
  }

  return await new Promise((resolve, reject) => {
    let resolved = false;
    const done = (rotatedFile?: string) => {
      if (!resolved) {
        resolved = true;
        resolve({ rotatedFile });
      }
    };

    const onError = (err: any) => {
      fileStream?.off?.('rotated', onRotated);
      if (!resolved) {
        resolved = true;
        // Resolve without throwing to avoid taking down admin ops; caller can proceed to delete by list
        resolve({});
      }
    };

    const onRotated = (...args: any[]) => {
      fileStream?.off?.('error', onError);
      const rotatedArg = args && args.length > 0 ? args[0] : undefined;
      const rotatedFile = typeof rotatedArg === 'string' ? rotatedArg : undefined;
      done(rotatedFile);
    };

    try {
      fileStream.once?.('rotated', onRotated);
      fileStream.once?.('error', onError);
      // Trigger rotation
      fileStream.rotate();
      // Safety timeout in case no events are emitted
      setTimeout(() => done(undefined), 2000);
    } catch {
      done(undefined);
    }
  });
}

export function getCurrentLogBasename() {
  // With rotating-file-stream, the current file is typically app.log in LOG_DIR
  return 'app.log';
}

export function getLogPathFor(name: string) {
  return path.join(LOG_DIR, name);
}
