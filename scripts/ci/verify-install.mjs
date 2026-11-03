import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

assert.equal(process.versions.node, "24.15.0", "Use the verified Node version");
function run(args) {
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    args,
    { shell: process.platform === "win32", encoding: "utf8" },
  );
  assert.equal(result.status, 0, "Package verification command failed");
  return result.stdout.trim();
}
assert.equal(run(["--version"]), "10.34.9");
run(["list", "--recursive", "--depth", "0"]);
if (process.platform === "linux") {
  assert.equal(
    process.arch,
    "x64",
    "Workspace native overrides currently support Linux x64 only",
  );
  assert.ok(
    process.report.getReport().header.glibcVersionRuntime,
    "Use GNU/glibc, not Alpine/musl",
  );
  run(["--filter", "@workspace/api-server", "exec", "esbuild", "--version"]);
  run([
    "--filter",
    "@workspace/rz-home-appliances-care",
    "exec",
    "vite",
    "--version",
  ]);
  const frontend = createRequire(
    new URL(
      "../../artifacts/rz-home-appliances-care/package.json",
      import.meta.url,
    ),
  );
  await import(pathToFileURL(frontend.resolve("@tailwindcss/vite")).href);
  console.log(
    "Node, pnpm, package graph and Linux GNU native tooling verified.",
  );
} else {
  console.log(
    "Node, pnpm and package graph verified. Linux GNU native checks NOT executed on this host.",
  );
}
