export function Injectable(...args: unknown[]) {
  void args;
  return function decorator(target: unknown) {
    void target;
    return undefined;
  };
}

export function Inject(...args: unknown[]) {
  void args;
  return function decorator(
    target: unknown,
    propertyKey?: string | symbol,
    parameterIndexOrDescriptor?: number | TypedPropertyDescriptor<unknown>,
  ) {
    void target;
    void propertyKey;
    void parameterIndexOrDescriptor;
    return undefined;
  };
}

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
