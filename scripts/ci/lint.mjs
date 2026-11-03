import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const dirs = [".", "scripts"];
for (const base of ["artifacts", "lib", "lib/integrations"]) {
  try {
    for (const entry of await readdir(base, { withFileTypes: true }))
      if (entry.isDirectory()) dirs.push(`${base}/${entry.name}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
let count = 0;
for (const dir of dirs) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(`${dir}/package.json`, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  if (!manifest.scripts?.lint) continue;
  count++;
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["--dir", dir, "run", "lint"],
    { stdio: "inherit", shell: process.platform === "win32" },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(
  count
    ? `Ran ${count} configured lint scripts.`
    : "Lint NOT RUN: no configured lint scripts exist in this workspace.",
);
