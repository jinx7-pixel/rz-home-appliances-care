import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAudit } from "./audit.mjs";
import { verifyTests } from "./verify-tests.mjs";

const now = new Date("2026-11-01T00:00:00Z");
const baseline = {
  reviewOwner: "Maintainer",
  reviewBy: "2026-11-15",
  findings: [
    {
      id: "GHSA-mrhx-c7xc-m3w5",
      package: "zod",
      version: "3.25.76",
      severity: "high",
      production: true,
      rationale: "Known",
      requiredReview: "Qualify migration",
    },
  ],
};
const audit = (changes = {}) => ({
  metadata: { vulnerabilities: { high: 1 } },
  advisories: {
    1: {
      url: "https://github.com/advisories/GHSA-mrhx-c7xc-m3w5",
      module_name: "zod",
      severity: "high",
      findings: [{ version: "3.25.76" }],
      ...changes,
    },
  },
});
test("exact known finding is reported as unresolved, including production scope", () => {
  const result = evaluateAudit(audit(), baseline, { now, production: true });
  assert.equal(result.accepted.length, 1);
  assert.deepEqual(result.failures, []);
});
test("new ID, installed version or severity fails comparison", () => {
  for (const change of [
    { url: "https://github.com/advisories/GHSA-new0-new0-new0" },
    { findings: [{ version: "3.25.75" }] },
    { severity: "critical" },
  ]) {
    assert.equal(
      evaluateAudit(audit(change), baseline, { now }).failures.length,
      1,
    );
  }
});
test("development-only findings cannot silently become production exceptions", () => {
  const dev = structuredClone(baseline);
  dev.findings[0].production = false;
  assert.equal(
    evaluateAudit(audit(), dev, { now, production: true }).failures.length,
    1,
  );
});
test("expired review and malformed or incomplete registry responses fail closed", () => {
  assert.throws(
    () => evaluateAudit(audit(), baseline, { now: new Date("2026-11-16") }),
    /review/,
  );
  for (const invalid of [
    {},
    { error: "registry unavailable" },
    { metadata: { vulnerabilities: { high: 1 } }, advisories: {} },
  ]) {
    assert.throws(() => evaluateAudit(invalid, baseline, { now }));
  }
});
test("a fixed dependency does not require retaining a vulnerability to pass", () => {
  assert.deepEqual(
    evaluateAudit(
      { advisories: {}, metadata: { vulnerabilities: { high: 0 } } },
      baseline,
      { now },
    ),
    { accepted: [], failures: [] },
  );
});

test("an empty baseline permits clean audits and rejects every reintroduced finding", () => {
  const empty = { ...baseline, findings: [] };
  assert.deepEqual(evaluateAudit({ advisories: {}, metadata: { vulnerabilities: { high: 0 } } }, empty, { now }), { accepted: [], failures: [] });
  assert.equal(evaluateAudit(audit(), empty, { now }).failures.length, 1);
});
const summary = (skip = 0) =>
  `# tests 39\n# pass 39\n# fail 0\n# skipped ${skip}\n# cancelled 0\n`;
test("strict test gate accepts TAP and spec summaries", () => {
  assert.equal(verifyTests(summary()), 39);
  assert.equal(verifyTests(summary().replaceAll("#", "ℹ")), 39);
});
test("strict test gate rejects skipped, filtered or missing summaries", () => {
  assert.throws(() => verifyTests(summary(1)));
  assert.throws(() => verifyTests(summary().replaceAll("39", "5")));
  assert.throws(() => verifyTests("no test results"));
});
