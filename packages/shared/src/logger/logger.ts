import pino, { type Logger } from "pino";

export interface CreateLoggerOptions {
  serviceName: string;
  level?: string;
  pretty?: boolean;
}

/**
 * Every service builds its root logger through this factory so log shape
 * (service name, timestamp format, level) is consistent across the system.
 * Correlation IDs are attached per-request via `logger.child({ requestId })`,
 * not baked in here.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const { serviceName, level = "info", pretty = false } = options;

  return pino({
    level,
    base: { service: serviceName },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: pretty
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
        }
      : undefined,
  });
}

export type { Logger };
