const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60, silent: 100 } as const;
export type LogLevel = keyof typeof LEVELS;

export interface Logger {
  debug(msg: string, obj?: Record<string, unknown>): void;
  info(msg: string, obj?: Record<string, unknown>): void;
  warn(msg: string, obj?: Record<string, unknown>): void;
  error(msg: string, obj?: Record<string, unknown>): void;
}

/** Logger JSON por líneas (compatible con cualquier agregador de logs). */
export function createLogger(level: LogLevel, name = 'server'): Logger {
  const min = LEVELS[level];
  const write = (lvl: LogLevel, msg: string, obj?: Record<string, unknown>) => {
    if (LEVELS[lvl] < min) return;
    const line = JSON.stringify({ t: new Date().toISOString(), lvl, name, msg, ...obj });
    if (LEVELS[lvl] >= LEVELS.warn) process.stderr.write(line + '\n');
    else process.stdout.write(line + '\n');
  };
  return {
    debug: (m, o) => write('debug', m, o),
    info: (m, o) => write('info', m, o),
    warn: (m, o) => write('warn', m, o),
    error: (m, o) => write('error', m, o),
  };
}
