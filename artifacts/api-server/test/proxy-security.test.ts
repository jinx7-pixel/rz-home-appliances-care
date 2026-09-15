import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import app from "../src/app.ts";

const apiServerRoot = fileURLToPath(new URL("..", import.meta.url));
const expectedTrustedProxyPeers = ["127.0.0.1/32", "::1/128"];
const unexpectedProxyConfigurationMessage =
  "Unexpected production proxy peer configuration; security review required before changing the trusted proxy list";

function runProductionApp(script: string, proxyPeers?: string): string {
  const environment = {
    ...process.env,
    NODE_ENV: "production",
  };

  if (proxyPeers === undefined) {
    delete environment.PRODUCTION_PROXY_PEERS;
  } else {
    environment.PRODUCTION_PROXY_PEERS = proxyPeers;
  }

  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "--eval",
      script,
    ],
    {
      cwd: apiServerRoot,
      env: environment,
      encoding: "utf8",
    },
  );

  assert.equal(
    result.status,
    0,
    `production app subprocess failed:\n${result.stderr}`,
  );
  return `${result.stdout}${result.stderr}`;
}

test("reports missing production proxy peer configuration", () => {
  const output = runProductionApp("import './src/app.ts';");

  assert.match(output, new RegExp(`"msg":"${unexpectedProxyConfigurationMessage}`));
  assert.match(output, /"configuredPeers":\[\]/);
  assert.match(output, /"expectedPeers":\["127\.0\.0\.1\/32","::1\/128"\]/);
});

test("reports mismatched production proxy peer configuration", () => {
  const output = runProductionApp(
    "import './src/app.ts';",
    "127.0.0.1/32,10.0.0.1/32",
  );

  assert.match(output, new RegExp(`"msg":"${unexpectedProxyConfigurationMessage}`));
  assert.match(output, /"configuredPeers":\["127\.0\.0\.1\/32","10\.0\.0\.1\/32"\]/);
  assert.match(output, /"expectedPeers":\["127\.0\.0\.1\/32","::1\/128"\]/);
});

test("keeps the exact trusted proxy allowlist", () => {
  assert.deepEqual(app.get("trust proxy"), expectedTrustedProxyPeers);

  const isTrustedProxy = app.get("trust proxy fn") as (address: string) => boolean;
  assert.equal(isTrustedProxy("127.0.0.1"), true);
  assert.equal(isTrustedProxy("::1"), true);
  assert.equal(isTrustedProxy("127.0.0.2"), false);
  assert.equal(isTrustedProxy("10.0.0.1"), false);
});

test("reports a request from an unexpected socket peer", () => {
  const output = runProductionApp(
    `
      import http from "node:http";
      import app from "./src/app.ts";

      const server = app.listen(0, "127.0.0.1");
      await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });

      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("expected the test server to have a TCP address");
      }

      await new Promise((resolve, reject) => {
        const request = http.request(
          {
            hostname: "127.0.0.1",
            port: address.port,
            path: "/api/healthz",
            localAddress: "127.0.0.2",
          },
          (response) => {
            response.resume();
            response.once("end", resolve);
          },
        );
        request.once("error", reject);
        request.end();
      });

      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    `,
    "127.0.0.1/32,::1/128",
  );

  assert.match(
    output,
    /"msg":"Request arrived from an unexpected production proxy peer; review the deployment ingress path before changing trusted proxy settings"/,
  );
  assert.match(output, /"remoteAddress":"127\.0\.0\.2"/);
});