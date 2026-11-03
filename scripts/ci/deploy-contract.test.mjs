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
const bootstrapScript = await read("scripts/deploy/bootstrap-vps.sh");

// Git for Windows ships bash; on CI the system bash is used. When bash is
// unavailable entirely the shell-based checks are skipped rather than failed.
const findBash = () => {
  const candidates = [
    "C:/Program Files/Git/bin/bash.exe",
    "C:/Program Files/Git/usr/bin/bash.exe",
  ];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {}
  }
  try {
    execFileSync("bash", ["--version"], { stdio: "ignore" });
    return "bash";
  } catch {}
  return null;
};

const posixPath = (relative) =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url)).replace(/\\/g, "/");

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
    /network_mode:\s*service:network/,
    "the api and frontend must share one network namespace",
  );
  // The Docker daemon refuses a custom host-to-IP mapping together with
  // network_mode: service:<name> ("conflicting options: custom host-to-IP
  // mapping and the network mode"), so extra_hosts must not be used here.
  assert.doesNotMatch(
    prodCompose,
    /extra_hosts:/,
    "extra_hosts cannot be combined with a shared network namespace",
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
  const bash = findBash();
  if (!bash) return;
  // execFileSync throws on a non-zero exit status, which is exactly the
  // signal we want: a bash syntax error fails the test.
  execFileSync(bash, ["-n", posixPath("scripts/deploy/deploy.sh")], {
    stdio: ["ignore", "pipe", "pipe"],
  });
});

test("the VPS bootstrap script has valid bash syntax", () => {
  const bash = findBash();
  if (!bash) return;
  execFileSync(bash, ["-n", posixPath("scripts/deploy/bootstrap-vps.sh")], {
    stdio: ["ignore", "pipe", "pipe"],
  });
});

test("the bootstrap script installs and enables Docker with Compose v2", () => {
  assert.match(bootstrapScript, /apt-get install -y docker\.io docker-compose-v2/);
  assert.match(bootstrapScript, /systemctl enable --now docker/);
  assert.match(
    bootstrapScript,
    /docker compose version/,
    "the Compose v2 plugin must be verified, not assumed",
  );
});

test("the bootstrap script points containers at the host bridge gateway", () => {
  assert.match(
    bootstrapScript,
    /DB_URL="\$\{DB_URL\/127\.0\.0\.1\/\$\{BRIDGE_GW\}\}"/,
    "the database URL host must be rewritten to the bridge gateway",
  );
  assert.match(
    bootstrapScript,
    /echo "DATABASE_URL=\$\{DB_URL\}"/,
    "the environment file must carry the rewritten URL",
  );
  assert.match(
    bootstrapScript,
    /docker network inspect bridge/,
    "the bridge address must be discovered, not hard-coded",
  );
  assert.doesNotMatch(
    bootstrapScript,
    /DATABASE_URL=postgresql:\/\/[^"\n]*127\.0\.0\.1/,
    "a loopback database URL would be unreachable from a container",
  );
  assert.doesNotMatch(
    bootstrapScript,
    /host\.docker\.internal:host-gateway/,
    "the api container shares a network namespace, so a host-to-IP mapping is not available",
  );
  assert.doesNotMatch(
    bootstrapScript,
    /DB_URL\/[^}\n]*host\.docker\.internal/,
    "the database URL must not be rewritten to a hostname the container cannot resolve",
  );
});

test("the bootstrap script lets the application role in from the Docker bridge pool", () => {
  // The container's source address is the address it holds on its own Compose
  // network, not the gateway it dials. Restricting pg_hba to the gateway
  // subnet would refuse every container connection.
  assert.match(
    bootstrapScript,
    /DOCKER_BRIDGE_RANGE="\$\{DOCKER_BRIDGE_RANGE:-172\.16\.0\.0\/12\}"/,
    "the Docker private bridge pool must be the allowed source range",
  );
  assert.match(
    bootstrapScript,
    /printf "host\\t%s\\t%s\\t%s\\t%s\\n" "\$DB_NAME" "\$DB_ROLE" "\$DOCKER_BRIDGE_RANGE" "\$AUTH_METHOD"/,
    "the pg_hba rule must cover the bridge pool for the application role",
  );
  assert.doesNotMatch(
    bootstrapScript,
    /printf "host\\tall\\tall/,
    "a blanket rule for every role and database must never be added",
  );
});

test("the bootstrap script backs up PostgreSQL configuration before changing it", () => {
  assert.match(
    bootstrapScript,
    /cp -a "\$\{PG_CONF_DIR\}\/postgresql\.conf" "\$\{BACKUP_DIR\}\/postgresql\.conf\.bak"/,
  );
  assert.match(
    bootstrapScript,
    /cp -a "\$\{PG_CONF_DIR\}\/pg_hba\.conf" "\$\{BACKUP_DIR\}\/pg_hba\.conf\.bak"/,
  );
  assert.match(bootstrapScript, /listen_addresses/);
  assert.match(bootstrapScript, /pg_hba\.conf/);
});

test("the bootstrap script reuses the existing production credentials on the VPS", () => {
  assert.match(
    bootstrapScript,
    /pm2 env 0/,
    "credentials must be reused from the running PM2 process, never typed by hand",
  );
  assert.doesNotMatch(
    bootstrapScript,
    /ADMIN_PASSWORD=(?!\$\{)/,
    "no administrator password may be hard-coded in the repository",
  );
  assert.doesNotMatch(
    bootstrapScript,
    /SMTP_APP_PASSWORD=(?!\$\{)/,
    "no SMTP password may be hard-coded in the repository",
  );
  assert.doesNotMatch(
    bootstrapScript,
    /DATABASE_URL=postgresql:\/\/[^$"\n]*:[^$"@\n]*@/,
    "no database password may be hard-coded in the repository",
  );
});

test("the bootstrap script never exposes a secret on stdout or in the log", () => {
  assert.doesNotMatch(
    bootstrapScript,
    /set\s+-x/,
    "shell tracing would write every secret into the deployment log",
  );
  assert.doesNotMatch(
    bootstrapScript,
    /cat\s+"?\$ENV_FILE/,
    "dumping the environment file would print every secret",
  );
  assert.match(
    bootstrapScript,
    /sed 's\/=\.\*\/=<set>\/'/,
    "the summary must mask every value it displays",
  );
  assert.match(bootstrapScript, /umask 077/);
  assert.match(bootstrapScript, /chmod 600 "\$ENV_FILE"/);
  assert.match(bootstrapScript, /install -d -m 750 "\$ENV_DIR"/);
});

test("the bootstrap script restarts PostgreSQL when listen_addresses must change", () => {
  // listen_addresses is a postmaster setting: a reload cannot change it, so a
  // script that only reloads would leave the containers unable to connect.
  assert.match(
    bootstrapScript,
    /systemctl restart postgresql/,
    "PostgreSQL must be restarted so that listen_addresses takes effect",
  );
  assert.match(
    bootstrapScript,
    /SHOW listen_addresses/,
    "the live value must be read before deciding to restart",
  );
  assert.match(
    bootstrapScript,
    /needs_restart/,
    "the restart must be conditional on the gateway not already being live",
  );
});

test("the deployment renders the Nginx template instead of copying it verbatim", () => {
  // Nginx cannot parse shell syntax. Copying the template verbatim would put
  // ${WEB_PORT:-8080} into the live configuration and nginx -t would fail.
  assert.match(
    deployScript,
    /sed "s\|\\\$\{WEB_PORT:-8080\}\|\$\{WEB_PORT\}\|g" "\$template" > "\$NGINX_SITE"/,
    "the port placeholder must be rendered before the file is installed",
  );
  assert.doesNotMatch(
    deployScript,
    /cp -a "\$template" "\$NGINX_SITE"/,
    "the template must never be installed without rendering",
  );
  assert.match(
    deployScript,
    /grep -q '\\\$\{' "\$NGINX_SITE"/,
    "a leftover shell placeholder must fail the switch",
  );
  assert.match(
    deployScript,
    /WEB_PORT="\$\{WEB_PORT:-8080\}"/,
    "the published port must be defined once and reused",
  );
  assert.match(hostNginx, /\$\{WEB_PORT:-8080\}/);
});

test("the public traffic switch is an explicit gate, not an implicit step", () => {
  assert.match(
    deployScript,
    /ALLOW_TRAFFIC_SWITCH=0/,
    "the traffic switch must default to not authorised",
  );
  assert.match(
    deployScript,
    /\[ "\$\{3:-\}" = "--allow-traffic-switch" \] && ALLOW_TRAFFIC_SWITCH=1/,
  );
  assert.match(
    deployScript,
    /if \[ "\$ALLOW_TRAFFIC_SWITCH" -eq 1 \]; then\s*\n\s*switch_nginx/,
    "switch_nginx must only run when the switch is authorised",
  );
  assert.match(
    deployScript,
    /TRAFFIC SWITCH NOT AUTHORISED/,
    "the run must state that the public traffic was left alone",
  );
  assert.match(
    deployWorkflow,
    /ALLOW_TRAFFIC_SWITCH: \$\{\{ vars\.ALLOW_TRAFFIC_SWITCH \}\}/,
    "the workflow must take the traffic authorisation from the Environment variable",
  );
  assert.match(
    deployWorkflow,
    /--allow-traffic-switch/,
    "the workflow must pass the switch flag to the deployment script",
  );
});

test("the loopback checks exercise the X-Forwarded-Proto path on the real stack", () => {
  assert.match(deployScript, /loopback_health_checks\(\)/);
  assert.match(
    deployScript,
    /-H 'X-Forwarded-Proto: https'/,
    "the same-origin check must supply the scheme the public edge sends",
  );
  assert.match(
    deployScript,
    /admin origin validation rejects a cross-origin request/,
    "a cross-origin request must still be rejected",
  );
  assert.match(
    deployScript,
    /die "admin origin validation rejected a same-origin request \(403\) - X-Forwarded-Proto is wrong"/,
    "a 403 on a same-origin request must fail the deployment",
  );
});

test("the bootstrap script never migrates, switches traffic or stops PM2", () => {
  for (const forbidden of [
    /migrate\.mjs/,
    /pm2 stop/,
    /pm2 delete/,
    /systemctl stop nginx/,
    /nginx -s reload/,
    /systemctl restart nginx/,
  ]) {
    assert.doesNotMatch(bootstrapScript, forbidden);
  }
});

test("the bootstrap script backs up working-tree files that differ from the deploy commit", () => {
  assert.match(bootstrapScript, /vps-local-modifications/);
  assert.match(bootstrapScript, /cp -a "\$\{APP_DIR\}\/\$\{f\}"/);
  assert.match(
    bootstrapScript,
    /git -C "\$APP_DIR" status --porcelain/,
    "local modifications must be discovered before anything is overwritten",
  );
});

test("the bootstrap logic suite passes", () => {
  const bash = findBash();
  if (!bash) return;
  execFileSync(bash, [posixPath("scripts/ci/bootstrap-logic.test.sh")], {
    stdio: ["ignore", "pipe", "pipe"],
  });
});
