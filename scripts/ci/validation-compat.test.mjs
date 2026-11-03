import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import http from "node:http";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  AdminAuthLoginResponse,
  CreateCustomerReviewBody,
  CreateRepairRequestBody,
  GetPublicReviewsQueryParams,
} from "../../lib/api-zod/src/generated/api.ts";

const frontend = createRequire(
  new URL("../../artifacts/rz-home-appliances-care/package.json", import.meta.url),
);
const { z } = frontend("zod");
const { zodResolver } = frontend("@hookform/resolvers/zod");
const repair = {
  customerName: "Synthetic Tester", phone: "9999999999",
  email: "tester@example.invalid", applianceType: "AC Repair",
  problemDescription: "Synthetic repair fixture", address: "Synthetic address",
};

test("Zod 4 preserves repair date coercion, optional values and unknown-key stripping", () => {
  const result = CreateRepairRequestBody.parse({
    ...repair, preferredDate: "2030-02-03", preferredTime: null, unexpected: true,
  });
  assert.equal(result.preferredDate.toISOString(), "2030-02-03T00:00:00.000Z");
  assert.equal(result.preferredTime, null);
  assert.equal("unexpected" in result, false);
  assert.equal(CreateRepairRequestBody.parse(repair).preferredDate, undefined);
  assert.equal(CreateRepairRequestBody.parse({ ...repair, preferredDate: null }).preferredDate, null);
});

test("Zod 4 retains field-error structure for invalid public repair inputs", () => {
  const result = CreateRepairRequestBody.safeParse({ ...repair, phone: 123, email: "invalid" });
  assert.equal(result.success, false);
  const errors = result.error.flatten();
  assert.deepEqual(Object.keys(errors.fieldErrors).sort(), ["email", "phone"]);
  assert.ok(errors.fieldErrors.phone.length > 0);
  assert.equal(CreateRepairRequestBody.safeParse(null).success, false);
  assert.equal(CreateRepairRequestBody.safeParse({ ...repair, applianceType: "Unsupported" }).success, false);
});

test("review rating bounds and query defaults remain compatible", () => {
  const review = { requestId: "RZ-SYNTHETIC", rating: 5, reviewMessage: "Synthetic review fixture", showFirstName: true };
  assert.equal(CreateCustomerReviewBody.safeParse(review).success, true);
  for (const rating of [0, 6, 1.5, "5", Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(CreateCustomerReviewBody.safeParse({ ...review, rating }).success, false);
  }
  assert.deepEqual(GetPublicReviewsQueryParams.parse({ limit: "5" }), { limit: 5 });
  assert.ok(GetPublicReviewsQueryParams.parse({}).limit > 0);
});

test("generated UUID responses accept PostgreSQL UUIDs and reject malformed values", () => {
  const admin = { id: "e265722b-4681-45f2-8a27-8af970b25150", username: "synthetic", displayName: "Synthetic" };
  assert.equal(AdminAuthLoginResponse.safeParse({ admin }).success, true);
  assert.equal(AdminAuthLoginResponse.safeParse({ admin: { ...admin, id: "not-a-uuid" } }).success, false);
});

const resolverOptions = { criteriaMode: "all", fields: {}, shouldUseNativeValidation: false };
test("resolver 5 returns Zod 4 field errors instead of throwing an obsolete error API", async () => {
  const resolve = zodResolver(z.object({ email: z.email() }));
  const result = await resolve({ email: "invalid" }, undefined, resolverOptions);
  assert.deepEqual(result.values, {});
  assert.equal(result.errors.email.type, "invalid_format");
  assert.ok(result.errors.email.message);
});

test("resolver 5 preserves transformed output with installed React Hook Form", async () => {
  const resolve = zodResolver(z.object({ quantity: z.coerce.number().int().min(1) }));
  const result = await resolve({ quantity: "2" }, undefined, resolverOptions);
  assert.deepEqual(result, { errors: {}, values: { quantity: 2 } });
});

test("Orval generates both configured clients without the removed TypeDoc dependency", async () => {
  const spec = createRequire(new URL("../../lib/api-spec/package.json", import.meta.url));
  const manifest = spec.resolve("orval/package.json");
  const orval = JSON.parse(await readFile(manifest, "utf8"));
  const fixture = await mkdtemp(join(tmpdir(), "rz-codegen-compat-"));
  const source = fileURLToPath(new URL("../../lib/api-spec/orval.config.ts", import.meta.url)).replaceAll("\\", "/");
  const input = fileURLToPath(new URL("../../lib/api-spec/openapi.yaml", import.meta.url)).replaceAll("\\", "/");
  const mutator = fileURLToPath(new URL("../../lib/api-client-react/src/custom-fetch.ts", import.meta.url)).replaceAll("\\", "/");
  const config = `import projects from ${JSON.stringify(source)};
const output = {};
for (const [name, project] of Object.entries(projects)) {
  output[name] = { ...project, input: { ...project.input, target: ${JSON.stringify(input)} },
    output: { ...project.output, workspace: ${JSON.stringify(fixture.replaceAll("\\", "/"))} + '/' + name,
      override: { ...project.output.override,
        ...(name === 'api-client-react' ? {mutator: {...project.output.override.mutator, path: ${JSON.stringify(mutator)}}} : {}) } } };
}
export default output;`;
  await writeFile(join(fixture, "orval.config.ts"), config);
  const result = spawnSync(process.execPath, [
    join(dirname(manifest), orval.bin.orval), "--config", join(fixture, "orval.config.ts"),
  ], { cwd: fixture, encoding: "utf8", timeout: 60_000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const validators = await readFile(join(fixture, "zod/generated/api.ts"), "utf8");
  const client = await readFile(join(fixture, "api-client-react/generated/api.ts"), "utf8");
  assert.match(validators, /export const CreateRepairRequestBody/);
  assert.match(validators, /zod\.email\(/);
  assert.match(client, /export const createRepairRequest|export function createRepairRequest/);
  assert.match(client, /useMutation/);
});

test("Orval and patched Undici resolve HTTP specifications and external refs on loopback", async () => {
  const requested = new Set();
  const server = http.createServer((request, response) => {
    requested.add(request.url);
    response.setHeader("Content-Type", "application/json");
    const document = request.url === "/models.json"
      ? { components: { schemas: { Synthetic: { type: "object", properties: { value: { type: "string" } }, required: ["value"] } } } }
      : { openapi: "3.0.0", info: { title: "Synthetic", version: "1" }, paths: { "/synthetic": { get: { operationId: "synthetic", responses: { "200": { description: "Synthetic", content: { "application/json": { schema: { $ref: "./models.json#/components/schemas/Synthetic" } } } } } } } } };
    response.end(JSON.stringify(document));
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  try {
    const fixture = await mkdtemp(join(tmpdir(), "rz-http-codegen-compat-"));
    const target = `http://127.0.0.1:${server.address().port}/openapi.json`;
    const config = { synthetic: { input: { target, parserOptions: { externalRefs: { allow: ["./models.json"] } } }, output: { target: join(fixture, "result.ts"), client: "zod", override: { zod: { version: 4 } } } } };
    await writeFile(join(fixture, "config.json"), JSON.stringify(config));
    const spec = createRequire(new URL("../../lib/api-spec/package.json", import.meta.url));
    const manifest = spec.resolve("orval/package.json");
    const orval = JSON.parse(await readFile(manifest, "utf8"));
    await promisify(execFile)(process.execPath, [join(dirname(manifest), orval.bin.orval), "--config", join(fixture, "config.json")], { cwd: fixture, timeout: 60_000 });
    assert.ok(requested.has("/openapi.json"));
    assert.ok(requested.has("/models.json"));
    assert.match(await readFile(join(fixture, "result.ts"), "utf8"), /zod\.string\(/);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
