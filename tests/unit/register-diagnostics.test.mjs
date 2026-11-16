import test from "node:test";
import assert from "node:assert/strict";
import { classifyRegisterError, createRegistrationSession, missingRegisterConfiguration, registerErrorLog } from "../../lib/server/register-diagnostics.js";

test("registration checks required configuration by name only", () => {
  assert.deepEqual(missingRegisterConfiguration({ MYSQL_URL: "", USER_SESSION_SECRET: "" }), ["MYSQL_URL", "USER_SESSION_SECRET"]);
  assert.deepEqual(missingRegisterConfiguration({ MYSQL_URL: "mysql://test", USER_SESSION_SECRET: "test-secret" }), []);
});

test("mysql errors map to stable registration responses", () => {
  assert.deepEqual(classifyRegisterError({ code: "ER_DUP_ENTRY" }).code, "EMAIL_TAKEN");
  assert.deepEqual(classifyRegisterError({ errno: 1062 }).status, 409);
  assert.equal(classifyRegisterError({ code: "ER_NO_SUCH_TABLE" }).code, "REGISTER_SCHEMA_ERROR");
  assert.equal(classifyRegisterError({ code: "ER_BAD_FIELD_ERROR" }).status, 500);
  assert.equal(classifyRegisterError({ code: "ER_TABLEACCESS_DENIED_ERROR" }).code, "REGISTER_WRITE_FORBIDDEN");
  assert.equal(classifyRegisterError({ sqlMessage: "read only transaction" }).code, "REGISTER_WRITE_FORBIDDEN");
  assert.equal(classifyRegisterError({ code: "ECONNREFUSED" }).status, 503);
  assert.equal(classifyRegisterError({ code: "PROTOCOL_SEQUENCE_TIMEOUT" }).code, "DATABASE_UNAVAILABLE");
  assert.equal(classifyRegisterError({ code: "SOME_OTHER_FAILURE" }).code, "REGISTER_FAILED");
});

test("registration logs include diagnostic codes without personal or secret input", () => {
  const serialized = JSON.stringify(registerErrorLog({
    requestId: "request-test-1",
    code: "REGISTER_FAILED",
    error: { code: "ER_BAD_FIELD_ERROR", errno: 1054, sqlState: "42S22", sqlMessage: "SQL with person@example.test and sample-password", sql: "INSERT INTO users VALUES (...)" },
  }));
  assert.match(serialized, /ER_BAD_FIELD_ERROR/);
  assert.doesNotMatch(serialized, /person@example\.test|sample-password|INSERT INTO|SQL with/);
});

test("failed session creation reports the already created account without deleting it", async () => {
  let inserted = 0;
  const result = await createRegistrationSession({
    input: { email: "person@example.test", password: "sample-password" },
    createUser: async () => { inserted += 1; return { id: "user-1" }; },
    createToken: () => { throw new Error("session signing unavailable"); },
  });
  assert.equal(inserted, 1);
  assert.equal(result.sessionCreated, false);
  assert.equal(result.token, null);
  assert.equal(result.user.id, "user-1");
});
