import type { Server } from "node:http";
import type { EventEmitter } from "node:events";

type Options = {
  closeResources: () => Promise<void>;
  logger: {
    info: (data: object, message: string) => void;
    error: (data: object, message: string) => void;
  };
  signals?: EventEmitter;
  exit?: (code: number) => void;
  timeoutMs?: number;
};

// Lifecycle only: request handlers, schema, cookies and proxy trust are unchanged.
export function installGracefulShutdown(server: Server, options: Options) {
  const signals = options.signals ?? process;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  let stopping = false;
  let timedOut = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    options.logger.info({ signal }, "Draining API connections");
    const deadline = setTimeout(() => {
      timedOut = true;
      options.logger.error({}, "API shutdown deadline exceeded");
      server.closeAllConnections();
      exit(1);
    }, options.timeoutMs ?? 15_000);
    deadline.unref();
    try {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      if (timedOut) return;
      await options.closeResources();
      if (timedOut) return;
      clearTimeout(deadline);
      options.logger.info({}, "API shutdown complete");
      exit(0);
    } catch {
      clearTimeout(deadline);
      if (timedOut) return;
      options.logger.error({}, "API shutdown failed");
      exit(1);
    }
  };
  const term = () => {
    void shutdown("SIGTERM");
  };
  const interrupt = () => {
    void shutdown("SIGINT");
  };
  signals.on("SIGTERM", term);
  signals.on("SIGINT", interrupt);
  return () => {
    signals.off("SIGTERM", term);
    signals.off("SIGINT", interrupt);
  };
}
