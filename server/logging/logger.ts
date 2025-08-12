import fs from 'fs';
import path from 'path';
import pino from 'pino';
import rfs from 'rotating-file-stream';

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

  fileStream = (rfs as any).createStream(generator as any, {
      path: LOG_DIR,
      size: LOG_ROTATION === 'size' ? LOG_MAX_SIZE : undefined,
      interval: LOG_ROTATION === 'daily' ? '1d' : undefined,
      compress: 'gzip',
      maxFiles: LOG_MAX_FILES,
      teeToStdout: false,
    } as any);
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
