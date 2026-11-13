// Runs vitest from a normalised path. On Windows a working directory with a lower-case drive letter
// (VS Code opens "c:\...") loads the runner and the test files' `vitest` from two different paths, so every
// suite fails with "Cannot read properties of undefined (reading 'config')". Upper-casing the drive fixes it.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const fix = (p) => (process.platform === "win32" ? p.charAt(0).toUpperCase() + p.slice(1) : p);
const root = fix(fileURLToPath(new URL("..", import.meta.url)));
const bin = fix(fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url)));
const { status } = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd: root, stdio: "inherit" });
process.exit(status ?? 1);
