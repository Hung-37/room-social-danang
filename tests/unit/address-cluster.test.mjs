import assert from "node:assert/strict";
import test from "node:test";
import {
  autoAssignCluster,
  ensureClusterAssigned,
  normalizeAddress,
} from "../../lib/policies/address-cluster.js";
import { normalizeListing } from "../../lib/collector/parser.js";

const cases = [
  ["378, Lê Thạch, Phường Hòa An, Quận Cẩm Lệ, Đà Nẵng", "Cho thuê", "cam-le"],
  ["Hoa An, Cam Le, Da Nang", "Phòng trọ gần Bách khoa", "cam-le"],
  ["Hòa Phước, Hòa Vang, Đà Nẵng", "Phòng trọ", "hoa-vang"],
  ["12 Lê Đình Dương, Hải Châu, Đà Nẵng", "Phòng trọ có cửa sổ", "hai-chau"],
  [
    "18 Nguyen Luong Bang, Hoa Khanh, Da Nang",
    "Phòng trọ giá rẻ",
    "bach-khoa-su-pham",
  ],
  [
    "Phan Tứ, Mỹ An, Đà Nẵng",
    "Phòng trọ gần đại học Bách khoa",
    "ngu-hanh-son",
  ],
  ["Hòa Minh, Đà Nẵng", "Phòng trọ sạch", "bach-khoa-su-pham"],
  ["Đà Nẵng", "Phòng trọ cho sinh viên", "chua-phan-cum"],
  [
    "15 Phạm Văn Đồng, Sơn Trà, Đà Nẵng",
    "Phòng gần đại học Bách khoa",
    "son-tra",
  ],
  ["Hòa Liên, Đà Nẵng", "Phòng trọ", "bach-khoa-su-pham"],
  ["Hòa Cường Bắc, Hải Châu, Đà Nẵng", "Phòng trọ", "hoa-cuong"],
  ["Hòa Quý, Ngũ Hành Sơn, Đà Nẵng", "Phòng trọ", "nam-da-nang"],
  ["Mỹ An, Hòa Khánh, Đà Nẵng", "Phòng trọ", "chua-phan-cum"],
  [
    "Đường chưa xác định",
    "Phòng sinh viên cạnh đại học Bách khoa",
    "chua-phan-cum",
  ],
  ["", "Phòng cạnh Đại học Bách khoa", "bach-khoa-su-pham"],
  ["", "Phòng cạnh Đại học Sư phạm Kỹ thuật", "hai-chau"],
  ["", "Gần Đại học Bách khoa và Đại học Kinh tế", "chua-phan-cum"],
  ["", "Phòng cho sinh viên gần trường", "chua-phan-cum"],
  ["Hoàng Sa, Sơn Trà", "Phòng trọ", "son-tra"],
];
for (const [address, title, expected] of cases) {
  test(`shared classification: ${address || title}`, () => {
    assert.equal(autoAssignCluster(address, title, ""), expected);
    assert.equal(
      normalizeListing(
        { title, address, description: "", price: 2000000 },
        { id: "test", name: "Test", url: "https://example.com/" },
      ).clusterId,
      expected,
    );
    assert.equal(
      autoAssignCluster(normalizeAddress(address), normalizeAddress(title), ""),
      expected,
    );
    assert.equal(
      autoAssignCluster(address.normalize("NFD"), title, ""),
      expected,
    );
  });
}
test("phrase boundaries prevent accidental short keyword matches", () => {
  assert.equal(
    autoAssignCluster("", "vkux dai hoc dong abc", ""),
    "chua-phan-cum",
  );
});
test("invalid supplied clusters are recomputed; a valid manual choice remains", () => {
  assert.equal(
    ensureClusterAssigned({
      address: "Hải Châu",
      clusterId: "invalid-user-value",
    }),
    "hai-chau",
  );
  assert.equal(
    ensureClusterAssigned({ address: "Hải Châu", clusterId: "hoa-cuong" }),
    "hoa-cuong",
  );
  assert.equal(
    ensureClusterAssigned({ address: "Hải Châu", clusterId: "chua-phan-cum" }),
    "hai-chau",
  );
});
