// Static contract for the GitHub Actions workflow.
//
// Branch protection on `main` requires a status-check context reported by the
// GitHub Actions app. GitHub derives a job's check-run name from the job
// `name:` when one is present and otherwise from the job id, so the job id and
// the job name must both equal the required context.
//
// This module is offline and deterministic: it inspects a parsed workflow
// document and never contacts GitHub. The remote branch-protection setting is
// the source of truth for the required context; this contract keeps the
// workflow aligned with it.

export const REQUIRED_CONTEXT = "check";

export const DEPENDENCY_JOBS = [
  "installation",
  "quality",
  "migrations",
  "backend",
  "security",
  "builds",
];

const asList = (value) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

// The context a job reports to GitHub.
export const reportedContext = (job) => job.name ?? job.id;

export function evaluateWorkflowContract(workflow) {
  const violations = [];
  const jobs = workflow?.jobs ?? {};

  const required = jobs[REQUIRED_CONTEXT];
  if (!required) {
    violations.push(
      `no job with the required id "${REQUIRED_CONTEXT}" exists; branch protection would never be satisfied`,
    );
    return { violations };
  }

  if (required.name !== REQUIRED_CONTEXT) {
    violations.push(
      `the required job reports the context "${reportedContext(required)}" but branch protection requires "${REQUIRED_CONTEXT}"`,
    );
  }

  const reporting = Object.entries(jobs)
    .filter(([, job]) => reportedContext(job) === REQUIRED_CONTEXT)
    .map(([id]) => id);
  if (reporting.length !== 1) {
    violations.push(
      `exactly one job must report the context "${REQUIRED_CONTEXT}", found ${reporting.length}: ${reporting.join(", ") || "none"}`,
    );
  }

  const needs = asList(required.needs);
  const missing = DEPENDENCY_JOBS.filter((job) => !needs.includes(job));
  if (missing.length) {
    violations.push(
      `the required job must depend on ${DEPENDENCY_JOBS.join(", ")}; missing ${missing.join(", ")}`,
    );
  }
  const extra = needs.filter((job) => !DEPENDENCY_JOBS.includes(job));
  if (extra.length) {
    violations.push(
      `the required job depends on unexpected job(s): ${extra.join(", ")}`,
    );
  }
  for (const job of DEPENDENCY_JOBS) {
    if (!jobs[job]) {
      violations.push(`dependency job "${job}" does not exist`);
    }
  }

  // Any job that is not listed in `needs` would run without being covered by
  // the required gate.
  for (const id of Object.keys(jobs)) {
    if (id === REQUIRED_CONTEXT) continue;
    if (!needs.includes(id)) {
      violations.push(
        `job "${id}" is not listed in the required job's needs and would be ungated`,
      );
    }
  }

  if (required.if !== "always()") {
    violations.push(
      `the required job must keep \`if: always()\` so a failed dependency cannot be skipped past`,
    );
  }

  const aggregation = (required.steps ?? []).find((step) =>
    step.name?.includes("Require every job to succeed"),
  );
  if (!aggregation) {
    violations.push("the aggregation step must exist");
  } else {
    if (!/job\.result !== 'success'/.test(aggregation.run ?? "")) {
      violations.push(
        "the aggregation step must fail when a dependency result is not 'success'",
      );
    }
    if (!/process\.exitCode = 1/.test(aggregation.run ?? "")) {
      violations.push(
        "the aggregation step must set a non-zero exit code when a dependency fails",
      );
    }
    if (aggregation.env?.RESULTS !== "${{ toJSON(needs) }}") {
      violations.push(
        "the aggregation step must read the dependency results from the needs context",
      );
    }
  }

  if (!required["runs-on"]) {
    violations.push("the required job must declare a runner");
  }
  if (!required["timeout-minutes"]) {
    violations.push("the required job must declare a timeout");
  }
  if (
    !(required.steps ?? []).some(
      (step) => step.name === "Record release boundary",
    )
  ) {
    violations.push("the release-boundary summary step must be preserved");
  }
  if (required.permissions !== undefined) {
    violations.push(
      "the required job must not declare its own permissions; the workflow-level least-privilege setting applies",
    );
  }

  for (const [id, job] of Object.entries(jobs)) {
    if (job["continue-on-error"] === true) {
      violations.push(`job "${id}" must not continue on error`);
    }
    for (const step of job.steps ?? []) {
      if (step["continue-on-error"] === true) {
        violations.push(
          `step "${step.name ?? step.uses ?? "unnamed"}" must not continue on error`,
        );
      }
    }
  }

  return { violations };
}
