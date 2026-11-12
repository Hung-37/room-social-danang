import nft from "next/dist/compiled/@vercel/nft/index.js";
const { nodeFileTrace } = nft;
import { copyFile, cp, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
const target = ".next/standalone";
// Next traces API bundles, but the pre-deploy initializer is a separate Node entry point.
const databaseScripts = (await readdir("scripts/db"))
  .filter((name) => name.endsWith(".mjs"))
  .sort()
  .map((name) => `scripts/db/${name}`);
const { fileList } = await nodeFileTrace(databaseScripts, {
  base: process.cwd(),
  processCwd: process.cwd(),
});
for (const file of fileList) {
  if (file.startsWith("../"))
    throw new Error("Unexpected dependency outside project root.");
  const destination = join(target, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(file, destination);
}
for (const [source, destination] of [
  ["public", "public"],
  [".next/static", ".next/static"],
  ["database", "database"],
]) {
  await mkdir(join(target, destination), { recursive: true });
  await cp(source, join(target, destination), { recursive: true, filter: (file) => !file.replaceAll("\\", "/").split("/").includes("mysql-data") });
}
await mkdir(join(target, "fixtures"), { recursive: true });
await copyFile(
  "fixtures/listings.json",
  join(target, "fixtures/listings.json"),
);
await mkdir(join(target, "data"), { recursive: true });
console.log("Standalone runtime and database initializer packaged.");
