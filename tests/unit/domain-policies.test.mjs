import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessAdmin,
  isValidEmail,
  isValidPassword,
  validateCommunityPost,
  validateListingInput,
} from "../../lib/policies/domain-policies.js";

test("auth policy accepts valid credentials and rejects malformed input", () => {
  assert.equal(isValidEmail("user@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidPassword("secret1"), true);
  assert.equal(isValidPassword("123"), false);
});

test("community policy requires a bounded title and body", () => {
  assert.equal(
    validateCommunityPost({
      id: "post-1",
      title: "Tìm phòng",
      summary: "Nội dung bài viết đủ dài để hợp lệ.",
    }),
    true,
  );
  assert.equal(
    validateCommunityPost({ id: "post-1", title: "Ngắn", summary: "quá ngắn" }),
    false,
  );
});

test("listing policy requires valid address, price and area", () => {
  const listing = {
    title: "Phòng gần trường",
    summary: "Phòng sạch",
    address: "Hải Châu",
    price: 2500000,
    area: 22,
  };
  assert.equal(validateListingInput(listing), true);
  assert.equal(validateListingInput({ ...listing, price: -1 }), false);
});

test("only admin role can access admin surfaces", () => {
  assert.equal(canAccessAdmin("admin"), true);
  assert.equal(canAccessAdmin("landlord"), false);
  assert.equal(canAccessAdmin("student"), false);
});

test("listing policy rejects blank, null, boolean and non-finite amounts", () => {
  const listing = {
    title: "Phòng sạch",
    summary: "Mô tả phòng",
    address: "Đà Nẵng",
    price: 2500000,
    area: 25,
  };
  for (const price of ["", null, false, true, 0, -1, Infinity, "abc"])
    assert.equal(
      validateListingInput({ ...listing, price }),
      false,
      `price ${price}`,
    );
  for (const area of ["", null, false, true, 0, -1, Infinity, "abc"])
    assert.equal(
      validateListingInput({ ...listing, area }),
      false,
      `area ${area}`,
    );
  assert.equal(
    validateListingInput({ ...listing, price: "2500000", area: "25.5" }),
    true,
  );
});

test("listing mutation accepts only primitive numeric fields, never coerced arrays/objects", () => {
  const listing = {
    title: "Phòng gần trường",
    summary: "Phòng sạch thoáng",
    address: "Hải Châu",
    price: 2500000,
    area: 25,
  };
  for (const value of [[2500000], ["2500000"], [[25]], {}, { value: 25 }, []]) {
    assert.equal(
      validateListingInput({ ...listing, price: value }),
      false,
      `price ${JSON.stringify(value)}`,
    );
    assert.equal(
      validateListingInput({ ...listing, area: value }),
      false,
      `area ${JSON.stringify(value)}`,
    );
  }
  assert.equal(
    validateListingInput({ ...listing, price: " 2500000 ", area: "25.5" }),
    true,
  );
});
