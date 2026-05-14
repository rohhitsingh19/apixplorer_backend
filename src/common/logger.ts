import { Logger } from '@nestjs/common';

/**
 * Creates a standard NestJS logger instance with the specified context.
 * 
 * @param context The context string (usually the class name or module)
 * @returns A NestJS Logger instance
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}
