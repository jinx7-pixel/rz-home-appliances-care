import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { installGracefulShutdown } from "../src/lib/shutdown.ts";

const logger = { info() {}, error() {} };
test("shutdown drains active requests before closing resources, and handles duplicate signals once", async () => {
  let finish!: () => void;
  const started = new EventEmitter();
  const server = http.createServer((_req, res) => {
    finish = () => res.end("complete");
    started.emit("ready");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const signals = new EventEmitter(),
    completed = new EventEmitter();
  let closed = 0;
  const done = once(completed, "exit");
  const cleanup = installGracefulShutdown(server, {
    signals,
    logger,
    closeResources: async () => {
      closed++;
    },
    exit: (code) => completed.emit("exit", code),
  });
  try {
    const ready = once(started, "ready");
    const response = fetch(
      `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    );
    await ready;
    signals.emit("SIGTERM");
    signals.emit("SIGINT");
    assert.equal(closed, 0);
    finish();
    assert.equal(await (await response).text(), "complete");
    assert.deepEqual(await done, [0]);
    assert.equal(closed, 1);
  } finally {
    cleanup();
    server.closeAllConnections();
    server.close();
  }
});
test("resource shutdown failure exits unsuccessfully", async () => {
  const server = http.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const signals = new EventEmitter(),
    completed = new EventEmitter();
  const done = once(completed, "exit");
  const cleanup = installGracefulShutdown(server, {
    signals,
    logger,
    closeResources: async () => {
      throw new Error("synthetic failure");
    },
    exit: (code) => completed.emit("exit", code),
  });
  signals.emit("SIGTERM");
  assert.deepEqual(await done, [1]);
  cleanup();
});
test("a stuck request reaches the bounded shutdown deadline", async () => {
  const started = new EventEmitter(),
    signals = new EventEmitter(),
    completed = new EventEmitter();
  const server = http.createServer(() => started.emit("ready"));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const done = once(completed, "exit");
  const cleanup = installGracefulShutdown(server, {
    signals,
    logger,
    timeoutMs: 30,
    closeResources: async () => {},
    exit: (code) => completed.emit("exit", code),
  });
  const ready = once(started, "ready");
  const request = fetch(
    `http://127.0.0.1:${(server.address() as { port: number }).port}`,
  ).catch(() => undefined);
  await ready;
  signals.emit("SIGTERM");
  assert.deepEqual(await done, [1]);
  await request;
  cleanup();
  server.closeAllConnections();
  server.close();
});
