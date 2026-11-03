import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function evaluateAudit(
  audit,
  baseline,
  { production = false, now = new Date() } = {},
) {
  if (
    !baseline.reviewOwner ||
    !/^\d{4}-\d{2}-\d{2}$/.test(baseline.reviewBy) ||
    !Number.isFinite(Date.parse(`${baseline.reviewBy}T23:59:59Z`)) ||
    now > new Date(`${baseline.reviewBy}T23:59:59Z`)
  ) {
    throw new Error(
      "Security baseline requires maintainer review: review date missing or expired.",
    );
  }
  if (
    !audit.advisories ||
    Array.isArray(audit.advisories) ||
    !audit.metadata?.vulnerabilities ||
    audit.error
  ) {
    throw new Error(
      "Invalid audit result; registry/network errors are not a passing audit.",
    );
  }
  const accepted = [],
    failures = [];
  for (const advisory of Object.values(audit.advisories)) {
    const id = advisory.url?.match(/\/advisories\/(GHSA-[a-z0-9-]+)$/)?.[1];
    if (!id || !advisory.findings?.length)
      throw new Error("Incomplete advisory data.");
    for (const finding of advisory.findings) {
      const entry = baseline.findings.find(
        (known) =>
          known.id === id &&
          known.package === advisory.module_name &&
          known.version === finding.version &&
          known.severity === advisory.severity &&
          (!production || known.production),
      );
      const description = `${id} ${JSON.stringify(advisory.module_name)}@${JSON.stringify(finding.version)} ${advisory.severity}`;
      if (!entry?.rationale || !entry.requiredReview)
        failures.push(description);
      else accepted.push(description);
    }
  }
  const count = Object.values(audit.metadata.vulnerabilities).reduce(
    (total, n) => total + n,
    0,
  );
  if (
    !Number.isFinite(count) ||
    count !== Object.keys(audit.advisories).length
  ) {
    throw new Error("Audit count mismatch; refusing an incomplete result.");
  }
  return { accepted: [...new Set(accepted)], failures: [...new Set(failures)] };
}

async function main() {
  const baseline = JSON.parse(
    await readFile(
      new URL("../../security/audit-baseline.json", import.meta.url),
      "utf8",
    ),
  );
  let failed = false,
    highRemains = false;
  for (const production of [false, true]) {
    const result = spawnSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["audit", "--json", ...(production ? ["--prod"] : [])],
      {
        encoding: "utf8",
        shell: process.platform === "win32",
        timeout: 120_000,
        maxBuffer: 10_000_000,
      },
    );
    if (result.error || ![0, 1].includes(result.status))
      throw new Error("Dependency audit process failed.");
    let audit;
    try {
      audit = JSON.parse(result.stdout);
    } catch {
      throw new Error("Audit did not return valid JSON.");
    }
    const evaluation = evaluateAudit(audit, baseline, { production });
    const scope = production ? "production" : "all";
    const summary = `Audit ${scope}: ${evaluation.accepted.length} known unresolved, ${evaluation.failures.length} unapproved findings. Review by ${baseline.reviewBy}.`;
    console.log(summary);
    for (const known of evaluation.accepted)
      console.log(`Known unresolved (${scope}): ${known}`);
    for (const finding of evaluation.failures)
      console.error(`UNAPPROVED (${scope}): ${finding}`);
    failed ||= evaluation.failures.length > 0;
    highRemains ||= Object.values(audit.advisories).some((a) =>
      ["high", "critical"].includes(a.severity),
    );
    if (process.env.RUNNER_TEMP)
      await writeFile(
        resolve(process.env.RUNNER_TEMP, `rz-audit-${scope}.json`),
        JSON.stringify(audit, null, 2),
      );
    if (process.env.GITHUB_STEP_SUMMARY)
      await writeFile(
        process.env.GITHUB_STEP_SUMMARY,
        `${summary}\n\n${evaluation.accepted.map((s) => `- OPEN: ${s}`).join("\n")}\n\n`,
        { flag: "a" },
      );
  }
  if (highRemains) {
    console.log(
      "Production release is BLOCKED by unresolved high/critical security findings. CI regression comparison is not release approval.",
    );
    if (process.argv.includes("--release")) failed = true;
  }
  if (failed) process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch(() => {
    console.error(
      "Security verification failed; inspect the audit/baseline without exposing credentials.",
    );
    process.exitCode = 1;
  });
}
