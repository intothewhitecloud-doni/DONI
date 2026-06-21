import { spawnSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const buildDir = ".omx/test-build";

rmSync(buildDir, { recursive: true, force: true });

const compile = spawnSync("npx", ["tsc", "-p", "tsconfig.policy-test.json"], { stdio: "inherit" });
if (compile.status !== 0) {
  process.exit(compile.status ?? 1);
}

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectTests(fullPath);
    }
    return entry.name.endsWith(".test.js") ? [fullPath] : [];
  });
}

const tests = collectTests(join(buildDir, "src"));
if (tests.length === 0) {
  throw new Error("No policy tests found.");
}

const run = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit" });
process.exit(run.status ?? 1);
