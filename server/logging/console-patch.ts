import type pino from 'pino';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';

let patched = false;

export function patchConsole(logger: pino.Logger) {
  if (patched) return;
  patched = true;

  const original: Record<ConsoleMethod, (...args: any[]) => void> = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  };

  const forward = (level: ConsoleMethod, args: any[]) => {
    try {
      // Always keep original console behavior
      original[level](...args);

      // Mirror to pino in a safe way
      const msg = args.map(a => {
        if (a instanceof Error) return a.stack || a.message;
        try {
          if (typeof a === 'object') return JSON.stringify(a);
          return String(a);
        } catch {
          return String(a);
        }
      }).join(' ');

      // Map console methods to pino levels
      switch (level) {
        case 'log':
        case 'info':
          logger.info(msg);
          break;
        case 'warn':
          logger.warn(msg);
          break;
        case 'error':
          logger.error(msg);
          break;
        case 'debug':
          logger.debug(msg);
          break;
      }
    } catch {
      // Avoid throwing from logging path
    }
  };

  console.log = (...args: any[]) => forward('log', args);
  console.info = (...args: any[]) => forward('info', args);
  console.warn = (...args: any[]) => forward('warn', args);
  console.error = (...args: any[]) => forward('error', args);
  console.debug = (...args: any[]) => forward('debug', args);
}
