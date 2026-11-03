import assert from "node:assert/strict";
import { access, readdir, stat } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
for (const path of [
  "artifacts/rz-home-appliances-care/dist/public/index.html",
  "artifacts/mockup-sandbox/dist/index.html",
  "artifacts/api-server/dist/index.mjs",
  "artifacts/api-server/dist/pino-worker.mjs",
  "artifacts/api-server/dist/thread-stream-worker.mjs",
  "artifacts/api-server/dist/pino-pretty.mjs",
]) {
  assert.ok(
    (await stat(new URL(path, root))).size > 0,
    `Missing/empty build output: ${path}`,
  );
}
const assets = await readdir(
  new URL("artifacts/rz-home-appliances-care/dist/public/assets/", root),
);
assert.ok(
  assets.some((name) => name.endsWith(".js")) &&
    assets.some((name) => name.endsWith(".css")),
);
await access(
  new URL("artifacts/api-server/node_modules/nodemailer/package.json", root),
);
console.log(
  "Frontend, mockup, API, logging workers and external Nodemailer dependency verified.",
);
