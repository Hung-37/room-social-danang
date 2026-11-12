import assert from "node:assert/strict";
import test from "node:test";
import { roomPhotos } from "../../lib/policies/room-photos.js";

test("the cover stays first and duplicate attachment URLs do not create extra thumbnails", () => {
  assert.deepEqual(
    roomPhotos("/api/images/a", ["/api/images/a", "/api/images/b"]),
    ["/api/images/a", "/api/images/b"],
  );
  assert.deepEqual(roomPhotos("", ["/api/images/b"]), ["/api/images/b"]);
});
test("malformed gallery values and unsafe image schemes cannot break the gallery", () => {
  assert.deepEqual(roomPhotos("javascript:alert(1)", {}), []);
  assert.deepEqual(
    roomPhotos("//untrusted.example/photo", [
      null,
      1,
      "data:text/html,x",
      "https://example.com/room.jpg",
    ]),
    ["https://example.com/room.jpg"],
  );
});
test("only four unique photos are displayed, with whitespace normalized", () => {
  assert.deepEqual(roomPhotos(" /a ", ["/b", "/c", "/d", "/e"]), [
    "/a",
    "/b",
    "/c",
    "/d",
  ]);
});
