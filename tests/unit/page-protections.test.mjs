import test from "node:test";
import assert from "node:assert/strict";
import { assessPageResponse } from "../../lib/page-protections.js";
test("assess explicit homepage controls and distinguish a failed request", () => {
  const page = {url: "https://example.org/", ok: true, headers: new Headers()};
  assert.equal(assessPageResponse(page).score, 1);
  page.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  page.headers.set("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none'");
  page.headers.set("X-Content-Type-Options", "nosniff");
  assert.equal(assessPageResponse(page).score, 5);
  page.headers.set("Content-Security-Policy", "default-src 'self'; script-src *; frame-ancestors *");
  page.headers.set("Strict-Transport-Security", "max-age=0");
  assert.equal(assessPageResponse(page).score, 2);
  assert.throws(() => assessPageResponse({...page, ok: false}));
});
