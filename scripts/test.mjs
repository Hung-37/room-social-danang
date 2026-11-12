import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
const files = (await readdir(new URL("../tests/unit/", import.meta.url)))
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => `tests/unit/${name}`);
if (!files.length) throw new Error("No unit tests found.");
const child = spawn(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
