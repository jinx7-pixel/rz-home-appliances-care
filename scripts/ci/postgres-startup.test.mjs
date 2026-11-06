import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const script = fileURLToPath(new URL("../deploy/repair-postgres-startup.sh", import.meta.url)).replaceAll("\\", "/");
const run = (args, options = {}) => spawnSync(bash, args, { encoding: "utf8", timeout: 10000, ...options });

for (const [scenario, threshold, expectedStatus] of [
  ["an assigned Docker address", 0, 0],
  ["Docker assigning its address after PostgreSQL is scheduled", 2, 0],
  ["an address that never appears", 100, 1],
]) {
  test(`startup guard handles ${scenario}`, async () => {
    const temp = await mkdtemp(path.join(tmpdir(), "rz-startup-test-"));
    try {
      const rendered = run(["-c", 'source "$1"; render_address_guard', "bash", script]);
      assert.equal(rendered.status, 0, rendered.stderr);
      await writeFile(path.join(temp, "guard.sh"), rendered.stdout);
      await writeFile(path.join(temp, "ip"), `#!/bin/sh
n=0; [ ! -f "$TEST_STATE" ] || n=$(cat "$TEST_STATE")
echo $((n + 1)) > "$TEST_STATE"
echo '1: lo inet 127.0.0.1/8 scope host lo'
if [ "$n" -ge ${threshold} ]; then echo '3: docker0 inet 172.17.0.1/16 scope global docker0'; fi
`);
      await writeFile(path.join(temp, "sleep"), "#!/bin/sh\nexit 0\n");
      const result = run(["-c", 'cd "$1"; chmod +x ip sleep; export PATH="$PWD:$PATH" TEST_STATE="$PWD/attempts"; sh guard.sh 172.17.0.1', "bash", temp.replaceAll("\\", "/")]);
      assert.equal(result.status, expectedStatus, result.stderr);
      const attempts = Number(await readFile(path.join(temp, "attempts"), "utf8"));
      assert.equal(attempts, threshold >= 30 ? 30 : threshold + 1);
      if (expectedStatus) assert.match(result.stderr, /startup blocked/);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
}

test("PostgreSQL startup orders Docker and checks its address, without coupling Docker stop to DB stop", () => {
  const rendered = run(["-c", 'source "$1"; render_startup_unit 172.17.0.1', "bash", script]);
  assert.equal(rendered.status, 0, rendered.stderr);
  assert.match(rendered.stdout, /^After=docker\.service$/m);
  assert.match(rendered.stdout, /^Wants=docker\.service$/m);
  assert.match(rendered.stdout, /^ExecStartPre=\/usr\/local\/libexec\/rzfixer-wait-docker-address 172\.17\.0\.1$/m);
  assert.doesNotMatch(rendered.stdout, /Requires=|BindsTo=|PartOf=/);
});

test("bootstrap repairs an absent socket even when SHOW listen_addresses contains the gateway", async () => {
  const bootstrap = await readFile(new URL("../deploy/bootstrap-vps.sh", import.meta.url), "utf8");
  const decision = bootstrap.slice(bootstrap.indexOf("  needs_restart=0"), bootstrap.indexOf('  if [ "$needs_restart" -eq 1 ]'));
  for (const [ready, expected] of [[0, "0"], [1, "1"]]) {
    const result = run(["-c", `live=localhost,172.17.0.1; BRIDGE_GW=172.17.0.1; pg_isready() { return ${ready}; }; ${decision}\nprintf '%s' "$needs_restart"`]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
  }
});

test("repair script parses without executing production actions", () => {
  const result = run(["-n", script]);
  assert.equal(result.status, 0, result.stderr);
});
