export class MutationError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "MUTATION_REJECTED",
  ) {
    super(message);
  }
}
export function requireVersion(value: unknown, current: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new MutationError("Phiên bản nội dung không hợp lệ.", 400);
  if (Number(value) !== Number(current))
    throw new MutationError(
      "Nội dung đã thay đổi. Hãy tải lại trước khi lưu hoặc xóa.",
      409,
      "VERSION_CONFLICT",
    );
}
