type LogPayload = Record<string, unknown> | undefined;

function write(level: 'info' | 'warn' | 'error', message: string, payload?: LogPayload) {
  if (payload === undefined) {
    console[level](message);
    return;
  }

  console[level](message, payload);
}

export class Logger {
  public info(message: string, payload?: LogPayload) {
    write('info', message, payload);
  }

  public warn(message: string, payload?: LogPayload) {
    write('warn', message, payload);
  }

  public error(message: string, payload?: LogPayload) {
    write('error', message, payload);
  }
}
