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
  await cp(source, join(target, destination), {
    recursive: true,
    filter: (file) => {
      const parts = file.replaceAll("\\", "/").split("/");
      return !parts.includes("mysql-data") && parts.at(-1) !== "setup_admin.sql";
    },
  });
}
await mkdir(join(target, "data", "fixtures"), { recursive: true });
await copyFile(
  "data/fixtures/listings.json",
  join(target, "data", "fixtures", "listings.json"),
);
console.log("Standalone runtime and database initializer packaged.");
