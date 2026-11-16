export function missingRegisterConfiguration(env = process.env) {
  return ["MYSQL_URL", "USER_SESSION_SECRET"].filter((name) => !env[name]?.trim());
}

export function classifyRegisterError(error) {
  const value = error && typeof error === "object" ? error : {};
  if (value.code === "ER_DUP_ENTRY" || value.errno === 1062)
    return { status: 409, code: "EMAIL_TAKEN", message: "Email này đã được đăng ký." };
  if (["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(value.code))
    return { status: 500, code: "REGISTER_SCHEMA_ERROR", message: "Hệ thống chưa sẵn sàng để tạo tài khoản." };
  if (["ER_TABLEACCESS_DENIED_ERROR", "ER_READ_ONLY_TRANSACTION", "ER_DBACCESS_DENIED_ERROR"].includes(value.code) || /read.only|read only/i.test(value.sqlMessage ?? ""))
    return { status: 500, code: "REGISTER_WRITE_FORBIDDEN", message: "Hệ thống tạm thời không thể tạo tài khoản." };
  if (["ECONNREFUSED", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST", "ECONNRESET", "POOL_ENQUEUELIMIT", "ER_CON_COUNT_ERROR", "PROTOCOL_SEQUENCE_TIMEOUT"].includes(value.code) || [1040, 1203].includes(value.errno))
    return { status: 503, code: "DATABASE_UNAVAILABLE", message: "Hệ thống đang bận. Vui lòng thử lại sau ít phút." };
  return { status: 500, code: "REGISTER_FAILED", message: "Không thể tạo tài khoản lúc này." };
}

export function registerErrorLog({ requestId, code, error }) {
  const value = error && typeof error === "object" ? error : {};
  return {
    timestamp: new Date().toISOString(),
    route: "/api/auth/register",
    code,
    mysqlCode: typeof value.code === "string" && /^[A-Z][A-Z0-9_]{1,39}$/.test(value.code) ? value.code : null,
    errno: typeof value.errno === "number" ? value.errno : null,
    sqlState: typeof value.sqlState === "string" && /^[A-Z0-9]{5}$/.test(value.sqlState) ? value.sqlState : null,
    requestId,
  };
}

export async function createRegistrationSession({ input, createUser, createToken }) {
  const user = await createUser(input);
  try {
    return { user, token: createToken(user), sessionCreated: true };
  } catch {
    return { user, token: null, sessionCreated: false };
  }
}
