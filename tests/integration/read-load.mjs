// Read-only load test; explicitly isolated loopback QA with perf-room fixtures.
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
const base = process.env.TEST_BASE_URL;
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error(
    "Require TEST_ISOLATED_DB=1 and an isolated localhost TEST_BASE_URL.",
  );
const fixture = await (
  await fetch(new URL("/api/listings?limit=1", base))
).json();
assert(
  fixture.data?.[0]?.externalId?.startsWith("perf-room-"),
  "Seed a separate QA database with tests/fixtures/data-loading.mjs first.",
);
const paths = [
  "/api/listings?limit=12",
  "/api/community/posts?limit=12",
  "/api/site/settings",
  "/api/health",
];
const report = {
  version: 1,
  base,
  fixture: "1,080 synthetic rooms / 88 discussions",
  readOnly: true,
  phases: [],
};
for (const concurrency of [5, 20, 50]) {
  const count = concurrency * 12,
    results = [];
  let next = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < count) {
        const index = next++,
          path = paths[index % paths.length],
          t = performance.now();
        try {
          const response = await fetch(new URL(path, base), {
            signal: AbortSignal.timeout(10000),
          });
          const payload = await response.json();
          const valid =
            path === "/api/health"
              ? payload.status === "ok"
              : path === "/api/site/settings"
                ? Boolean(payload.data?.siteName)
                : Array.isArray(payload.data) && payload.data.length === 12;
          results.push({
            path,
            status: response.status,
            valid,
            ms: performance.now() - t,
          });
        } catch (e) {
          results.push({
            path,
            status: 0,
            valid: false,
            ms: performance.now() - t,
            error: e.name,
          });
        }
      }
    }),
  );
  const sorted = results.map((x) => x.ms).sort((a, b) => a - b);
  const errors = results.filter((x) => x.status !== 200 || !x.valid);
  report.phases.push({
    concurrency,
    requests: count,
    durationMs: performance.now() - started,
    p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    errors,
    passed: errors.length === 0,
  });
}
const file = process.env.TEST_LOAD_REPORT || "work/read-load.json";
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
assert(
  report.phases.every((p) => p.passed),
  "Some requests failed; inspect the JSON report.",
);
