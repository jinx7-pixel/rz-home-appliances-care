import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (relative) =>
  readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

const containerNginx = await read("docker/nginx.conf");
const hostNginx = await read("docker/nginx.host.conf");
const prodCompose = await read("docker-compose.prod.yml");
const deployWorkflow = await read(".github/workflows/deploy.yml");
const deployScript = await read("scripts/deploy/deploy.sh");

test("the container Nginx never derives the forwarded scheme from $scheme", () => {
  // $scheme inside the container is always http, which made the API compute an
  // http:// request origin and reject every admin mutation with 403.
  assert.doesNotMatch(
    containerNginx,
    /proxy_set_header\s+X-Forwarded-Proto\s+\$scheme/,
    "X-Forwarded-Proto must not be built from $scheme",
  );
  assert.doesNotMatch(
    containerNginx,
    /proxy_set_header\s+X-Forwarded-Proto\s+\$http_x_forwarded_proto/,
    "the raw client-supplied header must not be forwarded unchecked",
  );
  assert.match(
    containerNginx,
    /proxy_set_header\s+X-Forwarded-Proto\s+\$rz_forwarded_proto/,
    "the validated scheme variable must be used",
  );
});

test("the container Nginx validates the forwarded scheme and client address", () => {
  assert.match(
    containerNginx,
    /map\s+\$http_x_forwarded_proto\s+\$rz_forwarded_proto\s*\{[^}]*default\s+http;[^}]*https\s+https;/s,
    "only the literal https token may select the scheme",
  );
  assert.match(
    containerNginx,
    /map\s+\$http_x_forwarded_for\s+\$rz_forwarded_for\s*\{/,
    "the forwarded client address must be validated",
  );
  assert.match(
    containerNginx,
    /proxy_set_header\s+X-Forwarded-For\s+\$rz_forwarded_for/,
    "the validated client address must be forwarded",
  );
});

test("the host Nginx carries the edge scheme and canonical redirect", () => {
  assert.match(hostNginx, /server_name\s+rzfixer\.in;/);
  assert.match(hostNginx, /server_name\s+www\.rzfixer\.in;/);
  assert.match(
    hostNginx,
    /return\s+308\s+https:\/\/rzfixer\.in\$request_uri;/,
    "www must redirect permanently to the apex, preserving the request URI",
  );
  assert.doesNotMatch(
    hostNginx,
    /return\s+30[12]\s+https:\/\/rzfixer\.in/,
    "301/302 would lose the request method for API calls",
  );
  assert.match(hostNginx, /set_real_ip_from\s+10\.10\.10\.0\/24;/);
  assert.match(hostNginx, /real_ip_header\s+X-Forwarded-For;/);
});

test("the production Compose stack exposes no database and no public port", () => {
  assert.doesNotMatch(
    prodCompose,
    /^\s{2}postgres:/m,
    "production must not define a database container",
  );
  assert.match(prodCompose, /internal:\s+true/);
  assert.match(
    prodCompose,
    /ports:\s*\['127\.0\.0\.1:\$\{WEB_PORT:-8080\}:8080'\]/,
    "the only published port must be bound to loopback",
  );
  assert.doesNotMatch(
    prodCompose,
    /ports:\s*\[[^\]]*\]:5432/,
    "no database port may be published",
  );
  assert.match(
    prodCompose,
    /host\.docker\.internal:host-gateway/,
    "the container must reach the native host database through the bridge gateway",
  );
  assert.match(prodCompose, /PRODUCTION_PROXY_PEERS:\s*127\.0\.0\.1\/32,::1\/128/);
  assert.match(prodCompose, /NODE_ENV:\s*production/);
  assert.match(prodCompose, /read_only:\s+true/);
  assert.match(prodCompose, /cap_drop:\s*\[ALL\]/);
  assert.match(prodCompose, /no-new-privileges:true/);
  assert.match(prodCompose, /restart:\s*unless-stopped/);
  // The production stack must be able to build its own images, because the
  // deployment builds them on the VPS from the deployed commit.
  assert.match(prodCompose, /dockerfile:\s*docker\/Dockerfile\.api/);
  assert.match(prodCompose, /dockerfile:\s*docker\/Dockerfile\.frontend/);
  assert.match(
    prodCompose,
    /image:\s*rzfixer-api:\$\{DEPLOY_TAG/,
    "the API image must be tagged with the deployed commit",
  );
  assert.match(
    prodCompose,
    /image:\s*rzfixer-frontend:\$\{DEPLOY_TAG/,
    "the frontend image must be tagged with the deployed commit",
  );
});

test("the CD workflow is CI-gated, environment-gated and never cancels a deploy", () => {
  assert.match(
    deployWorkflow,
    /workflow_run:\s*\n\s*workflows:\s*\["CI \(not release approval\)"\]/,
    "CD must chain from the CI workflow",
  );
  assert.match(deployWorkflow, /workflow_run\.conclusion\s*==\s*'success'/);
  assert.match(deployWorkflow, /workflow_run\.head_branch\s*==\s*'main'/);
  assert.match(deployWorkflow, /environment:\s*\n\s*name:\s*production/);
  assert.match(
    deployWorkflow,
    /concurrency:\s*\n\s*group:\s*deploy-production\s*\n\s*cancel-in-progress:\s*false/,
    "an active production deployment must never be cancelled",
  );
  assert.match(deployWorkflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(
    deployWorkflow,
    /StrictHostKeyChecking=yes/,
    "the VPS host key must be verified",
  );
  assert.match(deployWorkflow, /UserKnownHostsFile=/);
  assert.match(deployWorkflow, /IdentitiesOnly=yes/);
  assert.match(deployWorkflow, /secrets\.VPS_SSH_KEY/);
  assert.match(deployWorkflow, /secrets\.VPS_KNOWN_HOSTS/);
  // No application credential may ever appear in the workflow.
  for (const forbidden of [
    "DATABASE_URL",
    "SMTP_APP_PASSWORD",
    "ADMIN_PASSWORD",
    "EMAIL_FROM",
    "OWNER_EMAIL",
    "SMTP_HOST",
  ]) {
    assert.doesNotMatch(
      deployWorkflow,
      new RegExp(forbidden),
      `${forbidden} must not appear in the CD workflow`,
    );
  }
});

test("the deployment script is fail-closed and provides a rollback", () => {
  assert.match(deployScript, /^set -Eeuo pipefail$/m);
  assert.match(deployScript, /trap on_error ERR/);
  assert.match(deployScript, /rollback_restore/);
  // Destructive operations must never appear.
  for (const forbidden of [
    /DROP\s+DATABASE/i,
    /DROP\s+SCHEMA\s+public/i,
    /TRUNCATE/i,
    /rm\s+-rf\s+.*\/var\/lib\/postgresql/i,
  ]) {
    assert.doesNotMatch(deployScript, forbidden);
  }
  assert.match(deployScript, /pg_dump/);
  assert.match(deployScript, /pg_restore --list/);
  assert.match(deployScript, /migrate\.mjs check/);
  assert.match(deployScript, /--adopt-migration/);
  assert.match(deployScript, /checkout --force --detach/);
  assert.match(deployScript, /nginx -t/);
  assert.match(deployScript, /pm2 restart rz-api/);
  assert.match(
    deployScript,
    /admin origin validation accepts a same-origin request/,
    "the deployment must assert that a same-origin admin request is not rejected",
  );
});

test("the deployment script has valid bash syntax", () => {
  // Git for Windows ships bash; when it is unavailable the check is skipped
  // rather than failed, because CI runs this on ubuntu.
  const candidates = [
    "C:/Program Files/Git/bin/bash.exe",
    "C:/Program Files/Git/usr/bin/bash.exe",
  ];
  let bash = null;
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      bash = candidate;
      break;
    } catch {}
  }
  if (!bash) {
    execFileSync("bash", ["--version"], { stdio: "ignore" });
    bash = "bash";
  }
  const url = fileURLToPath(
    new URL("../../scripts/deploy/deploy.sh", import.meta.url),
  ).replace(/\\/g, "/");
  // execFileSync throws on a non-zero exit status, which is exactly the
  // signal we want: a bash syntax error fails the test.
  execFileSync(bash, ["-n", url], { stdio: ["ignore", "pipe", "pipe"] });
});
