import assert from "node:assert/strict";
let checks = 0;
for (const [name, key, status] of [
  ["complete", "TEST_BASE_URL", 200],
  ["empty", "TEST_EMPTY_BASE_URL", 503],
  ["partial", "TEST_PARTIAL_BASE_URL", 503],
  ["missing column", "TEST_OLD_BASE_URL", 503],
  ["unconfigured", "TEST_UNCONFIGURED_BASE_URL", 503],
  ["unreachable", "TEST_FAILURE_BASE_URL", 503],
]) {
  const base = process.env[key];
  if (
    process.env.TEST_ISOLATED_DB !== "1" ||
    !base ||
    !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
  )
    throw new Error("Require isolated loopback " + key);
  const response = await fetch(new URL("/api/health", base), {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, status, name);
  checks++;
  assert.match(response.headers.get("cache-control"), /no-store/);
  checks++;
  const p = await response.json();
  assert.equal(p.status, status === 200 ? "ok" : "unavailable");
  checks++;
  assert.match(p.version, /^\d+\.\d+\.\d+$/);
  checks++;
  assert.deepEqual(Object.keys(p).sort(), ["status", "version"]);
  checks++;
}
console.log(
  `PASS: ${checks} schema health checks: complete, empty, partial, missing migration column, missing config and unreachable database; no cached success or internal details.`,
);
