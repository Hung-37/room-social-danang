/** Bound SQL pagination to safe integers; malformed input uses the documented default. */
export function paginationInteger(value, fallback, maximum, minimum = 0) {
  if (value === null || value === undefined || String(value).trim() === "")
    return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum
    ? Math.min(number, maximum)
    : fallback;
}
