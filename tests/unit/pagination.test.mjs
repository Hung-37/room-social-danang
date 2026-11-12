import assert from "node:assert/strict";
import test from "node:test";
import { paginationInteger } from "../../lib/policies/pagination.js";

test("pagination rejects non-integer, unsafe and non-finite SQL parameters", () => {
  for (const raw of [
    "1.5",
    "-1",
    "Infinity",
    "NaN",
    "1e99",
    "invalid",
    "9007199254740992",
  ]) {
    assert.equal(paginationInteger(raw, 20, 50, 1), 20);
    assert.equal(paginationInteger(raw, 0, 2147483647), 0);
  }
  for (const raw of ["", null, undefined])
    assert.equal(paginationInteger(raw, 20, 50, 1), 20);
});
test("pagination respects caps and accepts a zero offset", () => {
  assert.equal(paginationInteger("200", 20, 50, 1), 50);
  assert.equal(paginationInteger("0", 0, 2147483647), 0);
  assert.equal(paginationInteger("0", 20, 50, 1), 20);
  assert.equal(paginationInteger("12", 20, 50, 1), 12);
});
