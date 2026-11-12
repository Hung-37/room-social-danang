/** One ordering policy for the cover, gallery and editor: cover first, at most four. */
export function roomPhotos(cover, gallery = []) {
  const valid = (value) =>
    typeof value === "string" &&
    (/^https?:\/\//i.test(value.trim()) || /^\/(?!\/)/.test(value.trim()));
  return [
    ...new Set(
      [cover, ...(Array.isArray(gallery) ? gallery : [])]
        .filter(valid)
        .map((value) => value.trim()),
    ),
  ].slice(0, 4);
}
