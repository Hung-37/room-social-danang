import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL;
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD
)
  throw new Error("Set TEST_ISOLATED_DB=1, local TEST_BASE_URL and isolated admin test credentials.");

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const payload = { name: "Registration QA", email: `register-${suffix}@test.local`, password: "Register-QA-Only-123!", role: "student" };
const register = () => fetch(`${base}/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

const created = await register();
assert.equal(created.status, 201);
const createdPayload = await created.json();
assert.ok(createdPayload.data?.id);

const duplicate = await register();
assert.equal(duplicate.status, 409);
const duplicatePayload = await duplicate.json();
assert.equal(duplicatePayload.code, "EMAIL_TAKEN");
assert.ok(duplicatePayload.requestId);
assert.equal(duplicate.headers.get("x-request-id"), duplicatePayload.requestId);
assert.doesNotMatch(JSON.stringify(duplicatePayload), /register-[^@]+@test\.local|Register-QA-Only-123!/);

for (const [envName, code, status] of [
  ["TEST_MISCONFIGURED_BASE_URL", "SERVER_MISCONFIGURED", 500],
  ["TEST_SCHEMA_FAILURE_BASE_URL", "REGISTER_SCHEMA_ERROR", 500],
  ["TEST_DATABASE_FAILURE_BASE_URL", "DATABASE_UNAVAILABLE", 503],
  ["TEST_PERMISSION_FAILURE_BASE_URL", "REGISTER_WRITE_FORBIDDEN", 500],
]) {
  const target = process.env[envName];
  if (!target) continue;
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(target).hostname), `${envName} must be localhost.`);
  const response = await fetch(`${target}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, email: `${envName.toLowerCase()}-${suffix}@test.local` }),
  });
  const body = await response.json();
  assert.equal(response.status, status, `${envName}: ${JSON.stringify(body)}`);
  assert.equal(body.code, code, `${envName}: ${JSON.stringify(body)}`);
  assert.ok(body.requestId, `${envName} request id missing.`);
  assert.equal(response.headers.get("x-request-id"), body.requestId);
  assert.doesNotMatch(JSON.stringify(body), /@test\.local|Register-QA-Only-123!/);
}

const privateReadiness = await fetch(`${base}/api/health/ready`);
assert.equal(privateReadiness.status, 401);

const login = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }),
});
assert.equal(login.status, 200);
const cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
const readiness = await fetch(`${base}/api/health/ready`, { headers: { cookie } });
const readinessPayload = await readiness.json();
assert.equal(readiness.status, 200, JSON.stringify(readinessPayload));
assert.equal(readinessPayload.database, true);
assert.equal(readinessPayload.schema.usersTable, true);
assert.equal(readinessPayload.schema.emailUnique, true);
assert.equal(readinessPayload.writePrivilegeReported, true);

console.log("PASS: registration, mysql2 duplicate mapping, request id, safe error response, protected read-only readiness.");
