import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  evaluateReplitConfig,
  isSecretBearingKey,
  isUserenvSection,
} from "./check-replit.mjs";

const read = (relative) => readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

test("the tracked .replit file carries no shared environment or secret entries", async () => {
  const contents = await read(".replit");
  assert.deepEqual(evaluateReplitConfig(contents).violations, []);
});

test("the tracked .replit file retains the required Replit deployment configuration", async () => {
  const contents = await read(".replit");
  assert.match(contents, /^modules\s*=\s*\[/m);
  assert.match(contents, /^\[deployment\]$/m);
  assert.match(contents, /^router\s*=\s*"application"$/m);
  assert.match(contents, /^deploymentTarget\s*=\s*"autoscale"$/m);
  assert.match(contents, /^\[deployment\.postBuild\]$/m);
  assert.match(contents, /^args\s*=\s*\["pnpm",\s*"store",\s*"prune"\]$/m);
  assert.match(contents, /^\[agent\]$/m);
  assert.match(contents, /^stack\s*=\s*"PNPM_WORKSPACE"$/m);
  assert.match(contents, /^\[postMerge\]$/m);
  assert.match(contents, /^path\s*=\s*"scripts\/post-merge\.sh"$/m);
  assert.match(contents, /^timeoutMs\s*=\s*20000$/m);
  assert.match(contents, /^\[nix\]$/m);
  assert.match(contents, /^channel\s*=\s*"stable-25_05"$/m);
});

test("every shared environment section is rejected", () => {
  for (const section of [
    "[userenv]",
    "[userenv.shared]",
    "[userenv.production]",
    "[userenv.staging]",
    "[UserEnv.Shared]",
    "[ userenv.shared ]",
  ]) {
    const { violations } = evaluateReplitConfig(`${section}\nSMTP_HOST = "smtp.gmail.com"\n`);
    assert.equal(violations.length, 1, `expected a violation for ${section}`);
    assert.match(violations[0], /userenv/i);
  }
});

test("a shared environment section is rejected even when it holds no values", () => {
  assert.equal(evaluateReplitConfig("[userenv]\n").violations.length, 1);
});

test("secret-bearing keys are rejected anywhere in the file", () => {
  for (const key of [
    "PASSWORD",
    "password",
    "SMTP_APP_PASSWORD",
    "ADMIN_PASSWORD",
    "SECRET",
    "GITHUB_TOKEN",
    "API_KEY",
    "APIKEY",
    "PRIVATE_KEY",
    "ACCESS_KEY",
    "CLIENT_SECRET",
    "CREDENTIALS",
  ]) {
    const { violations } = evaluateReplitConfig(`${key} = "synthetic-value"\n`);
    assert.equal(violations.length, 1, `expected a violation for ${key}`);
    assert.match(violations[0], /secret-bearing key/i);
  }
});

test("ordinary configuration keys are not reported", () => {
  for (const key of [
    "path",
    "timeoutMs",
    "expertMode",
    "modules",
    "stack",
    "channel",
    "PRODUCTION_PROXY_PEERS",
    "NODE_ENV",
    "PORT",
    "args",
    "env",
  ]) {
    assert.equal(isSecretBearingKey(key), false, `${key} must not be treated as secret`);
    assert.deepEqual(evaluateReplitConfig(`${key} = "value"\n`).violations, []);
  }
});

test("high-confidence secret values are rejected even under an innocuous key", () => {
  // Built from fragments so no secret-shaped literal is committed to this
  // public repository. Secret-scanning push protection rejects such strings.
  const samples = [
    ["gh", "p_abcdefghijklmnopqrstuvwxyz012345"].join(""),
    ["AKIA", "ZZZZZZZZZZZZZZZZ"].join(""),
    ["-----BEGIN RSA ", "PRIVATE KEY-----"].join(""),
    [
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      ".eyJzdWIiOiIxMjM0NTY3ODkwIn0",
      ".abcdef",
    ].join(""),
    ["xox", "b-1234567890-abcdefghijkl"].join(""),
  ];
  for (const sample of samples) {
    // A neutral key proves the value shape alone is detected.
    const { violations } = evaluateReplitConfig(`NOTE = "${sample}"\n`);
    assert.ok(violations.length >= 1, `expected a violation for ${sample.slice(0, 20)}`);
    assert.ok(
      violations.some((violation) => /matches a .* pattern/.test(violation)),
      `expected a value-pattern violation for ${sample.slice(0, 20)}`,
    );
  }
});

test("a clean configuration produces no violations", () => {
  const contents = [
    'modules = ["nodejs-24", "python-base-3.13", "postgresql-16"]',
    "",
    "[deployment]",
    'router = "application"',
    'deploymentTarget = "autoscale"',
    "",
    "[deployment.postBuild]",
    'args = ["pnpm", "store", "prune"]',
    'env = { "CI" = "true" }',
    "",
    "[agent]",
    'stack = "PNPM_WORKSPACE"',
    "expertMode = true",
    "",
    "[postMerge]",
    'path = "scripts/post-merge.sh"',
    "timeoutMs = 20000",
    "",
    "[nix]",
    'channel = "stable-25_05"',
    "",
  ].join("\n");
  assert.deepEqual(evaluateReplitConfig(contents).violations, []);
});

test("an inline comment cannot mask a secret-bearing entry", () => {
  const { violations } = evaluateReplitConfig(
    'ADMIN_PASSWORD = "synthetic-value" # documented in the runbook\n',
  );
  assert.equal(violations.length, 1);
});

test("section detection ignores unrelated configuration sections", () => {
  for (const section of [
    "[deployment]",
    "[deployment.postBuild]",
    "[agent]",
    "[postMerge]",
    "[nix]",
    "[services.production.run.env]",
  ]) {
    assert.equal(isUserenvSection(section), false);
  }
  assert.equal(isUserenvSection("userenv.shared"), true);
});

test("the API artifact manifest keeps its functional proxy peer value without internal runbook notes", async () => {
  const manifest = await read("artifacts/api-server/.replit-artifact/artifact.toml");
  assert.match(manifest, /^PRODUCTION_PROXY_PEERS\s*=\s*"127\.0\.0\.1\/32,::1\/128"$/m);
  assert.doesNotMatch(manifest, /on-call/i);
  assert.doesNotMatch(manifest, /Operational alert/i);
  assert.doesNotMatch(manifest, /production-ingress-peer-drift/);
  assert.match(manifest, /^\[services\.production\.health\.startup\]$/m);
  assert.match(manifest, /^path\s*=\s*"\/api\/healthz"$/m);
});

test("the frontend artifact manifest describes RZ Fixer rather than the original template", async () => {
  const manifest = await read("artifacts/rz-home-appliances-care/.replit-artifact/artifact.toml");
  assert.match(manifest, /^title\s*=\s*"RZ Fixer"$/m);
  assert.match(manifest, /RZ Fixer/);
  assert.doesNotMatch(manifest, /navigation bar/i);
});

test("the local agent memory note is no longer published inside the repository", async () => {
  await assert.rejects(
    () => read(".agents/memory/shared-environment-storage.md"),
    (error) => error.code === "ENOENT",
  );
  const index = await read(".agents/memory/MEMORY.md");
  assert.doesNotMatch(index, /shared-environment-storage/);
});
