import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import {
  DEPENDENCY_JOBS,
  REQUIRED_CONTEXT,
  evaluateWorkflowContract,
  reportedContext,
} from "./workflow-contract.mjs";

// js-yaml is pinned by the workspace override and reaches the tree through
// Orval's dependency graph, so it is resolved from that package rather than
// being added as a new dependency.
const specRequire = createRequire(
  new URL("../../lib/api-spec/package.json", import.meta.url),
);
const orvalRequire = createRequire(specRequire.resolve("orval/package.json"));
const yaml = orvalRequire("js-yaml");

const workflow = yaml.load(
  await readFile(new URL("../../.github/workflows/main.yml", import.meta.url), "utf8"),
);

const clone = () => structuredClone(workflow);

test("the tracked workflow satisfies the required-check contract", () => {
  assert.deepEqual(evaluateWorkflowContract(workflow).violations, []);
});

test("the aggregate required job uses the exact required check context", () => {
  assert.ok(workflow.jobs[REQUIRED_CONTEXT], "a job with the required id must exist");
  assert.equal(workflow.jobs[REQUIRED_CONTEXT].name, REQUIRED_CONTEXT);
  assert.equal(
    workflow.jobs["ci-required"],
    undefined,
    "the previous job id must no longer exist",
  );
});

test("exactly one job reports the required check context", () => {
  const reporting = Object.entries(workflow.jobs)
    .filter(([, job]) => reportedContext(job) === REQUIRED_CONTEXT)
    .map(([id]) => id);
  assert.deepEqual(reporting, [REQUIRED_CONTEXT]);
});

test("the required job depends on exactly the six CI jobs", () => {
  assert.deepEqual(workflow.jobs[REQUIRED_CONTEXT].needs, DEPENDENCY_JOBS);
  for (const job of DEPENDENCY_JOBS) {
    assert.ok(workflow.jobs[job], `dependency job ${job} must exist`);
  }
});

test("every other job is gated by the required job", () => {
  const gated = new Set(workflow.jobs[REQUIRED_CONTEXT].needs);
  for (const id of Object.keys(workflow.jobs)) {
    if (id === REQUIRED_CONTEXT) continue;
    assert.ok(
      gated.has(id),
      `job "${id}" is not listed in the required job's needs and would be ungated`,
    );
  }
});

test("the required job always runs so a failed dependency cannot be skipped past", () => {
  assert.equal(workflow.jobs[REQUIRED_CONTEXT].if, "always()");
});

test("the required job fails when any dependency does not succeed", () => {
  const step = workflow.jobs[REQUIRED_CONTEXT].steps.find((entry) =>
    entry.name?.includes("Require every job to succeed"),
  );
  assert.ok(step, "the aggregation step must exist");
  assert.match(step.run, /job\.result !== 'success'/);
  assert.match(step.run, /process\.exitCode = 1/);
  assert.equal(step.env.RESULTS, "${{ toJSON(needs) }}");
});

test("the required job keeps its runner, timeout and summary step", () => {
  const job = workflow.jobs[REQUIRED_CONTEXT];
  assert.equal(job["runs-on"], "ubuntu-24.04");
  assert.equal(job["timeout-minutes"], 5);
  assert.ok(
    job.steps.some((entry) => entry.name === "Record release boundary"),
    "the release-boundary summary step must be preserved",
  );
});

test("the release boundary still records that CI is not release approval", () => {
  const summary = workflow.jobs[REQUIRED_CONTEXT].steps.find(
    (entry) => entry.name === "Record release boundary",
  );
  assert.match(summary.run, /not production risk acceptance/);
  assert.match(summary.run, /No deployment is performed/);
});

test("the six dependency jobs keep their runner, timeout and wiring", () => {
  for (const id of DEPENDENCY_JOBS) {
    const job = workflow.jobs[id];
    assert.equal(job["runs-on"], "ubuntu-24.04", `${id} must keep its runner`);
    assert.ok(job["timeout-minutes"], `${id} must keep a timeout`);
  }
  assert.equal(workflow.jobs.installation.needs, undefined);
  for (const id of DEPENDENCY_JOBS.filter((job) => job !== "installation")) {
    // `needs:` may be a bare string or a list; normalise before comparing.
    const needs = Array.isArray(workflow.jobs[id].needs)
      ? workflow.jobs[id].needs
      : [workflow.jobs[id].needs];
    assert.deepEqual(
      needs,
      ["installation"],
      `${id} must still depend on the installation job`,
    );
  }
});

test("the workflow keeps least-privilege permissions and its triggers", () => {
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const triggers = workflow[true] ?? workflow.on;
  assert.deepEqual(triggers.push.branches, ["main"]);
  assert.deepEqual(triggers.pull_request.branches, ["main"]);
  assert.ok(triggers.workflow_dispatch !== undefined);
});

test("no job or step bypasses the gate with continue-on-error", () => {
  for (const [id, job] of Object.entries(workflow.jobs)) {
    assert.notEqual(
      job["continue-on-error"],
      true,
      `job "${id}" must not continue on error`,
    );
    for (const step of job.steps ?? []) {
      assert.notEqual(
        step["continue-on-error"],
        true,
        `step "${step.name ?? step.uses ?? step.run}" must not continue on error`,
      );
    }
  }
});

test("renaming the required job is detected", () => {
  const mutated = clone();
  mutated.jobs.ci_required = mutated.jobs[REQUIRED_CONTEXT];
  delete mutated.jobs[REQUIRED_CONTEXT];
  const { violations } = evaluateWorkflowContract(mutated);
  assert.ok(violations.length > 0);
  assert.match(violations.join("\n"), /required id/i);
});

test("renaming the reported display name is detected", () => {
  const mutated = clone();
  mutated.jobs[REQUIRED_CONTEXT].name = "Required CI checks";
  const { violations } = evaluateWorkflowContract(mutated);
  assert.ok(violations.length > 0);
  assert.match(violations.join("\n"), /requires "check"/i);
});

test("dropping a dependency from the required job is detected", () => {
  const mutated = clone();
  mutated.jobs[REQUIRED_CONTEXT].needs = mutated.jobs[REQUIRED_CONTEXT].needs.filter(
    (job) => job !== "backend",
  );
  const { violations } = evaluateWorkflowContract(mutated);
  assert.ok(violations.length > 0);
  assert.match(violations.join("\n"), /missing backend/i);
});

test("adding an ungated job is detected", () => {
  const mutated = clone();
  mutated.jobs.extra = {
    "runs-on": "ubuntu-24.04",
    "timeout-minutes": 5,
    steps: [{ run: "true" }],
  };
  const { violations } = evaluateWorkflowContract(mutated);
  assert.ok(violations.length > 0);
  assert.match(violations.join("\n"), /ungated/i);
});

test("removing the always() condition is detected", () => {
  const mutated = clone();
  delete mutated.jobs[REQUIRED_CONTEXT].if;
  const { violations } = evaluateWorkflowContract(mutated);
  assert.ok(violations.length > 0);
  assert.match(violations.join("\n"), /always\(\)/i);
});

test("weakening the aggregation failure propagation is detected", () => {
  const mutated = clone();
  const step = mutated.jobs[REQUIRED_CONTEXT].steps.find((entry) =>
    entry.name?.includes("Require every job to succeed"),
  );
  step.run = "console.log('done')";
  const { violations } = evaluateWorkflowContract(mutated);
  assert.ok(violations.length > 0);
  assert.match(violations.join("\n"), /non-zero exit code/i);
});

test("a continue-on-error bypass is detected", () => {
  const mutated = clone();
  mutated.jobs.backend["continue-on-error"] = true;
  const { violations } = evaluateWorkflowContract(mutated);
  assert.ok(violations.length > 0);
  assert.match(violations.join("\n"), /continue on error/i);
});
