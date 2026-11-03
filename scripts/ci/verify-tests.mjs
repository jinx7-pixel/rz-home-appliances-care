import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function verifyTests(contents) {
  const text = contents.replace(/\u001b\[[0-9;]*m/g, "");
  const metric = (name) => {
    const match = text.match(
      new RegExp(`^(?:#|ℹ)\\s+${name}\\s+(\\d+)\\s*$`, "m"),
    );
    assert.ok(match, `Missing test summary: ${name}`);
    return Number(match[1]);
  };
  const tests = metric("tests"),
    passed = metric("pass");
  assert.ok(
    tests >= 39,
    "Expected the complete backend suite, not an empty or filtered run",
  );
  assert.equal(passed, tests);
  for (const name of ["fail", "skipped", "cancelled"])
    assert.equal(metric(name), 0, `Nonzero ${name}`);
  return tests;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const count = verifyTests(await readFile(process.argv[2], "utf8"));
  console.log(
    `Verified ${count} passing tests with zero failures, cancellations or skips.`,
  );
}
