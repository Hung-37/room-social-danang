export type RegisterFailure = {
  status: number;
  code: string;
  message: string;
};

export function missingRegisterConfiguration(env?: NodeJS.ProcessEnv): string[];
export function classifyRegisterError(error: unknown): RegisterFailure;
export function registerErrorLog(input: { requestId: string; code: string; error: unknown }): Record<string, unknown>;
export type RegisteredUser = { id: string; name: string; email: string; role: "student" | "landlord" | "admin" };
export function createRegistrationSession(input: {
  input: { name: string; email: string; password: string; role: "student" | "landlord" };
  createUser: (input: { name: string; email: string; password: string; role: "student" | "landlord" }) => Promise<RegisteredUser>;
  createToken: (user: RegisteredUser) => string;
}): Promise<
  | { user: RegisteredUser; token: string; sessionCreated: true }
  | { user: RegisteredUser; token: null; sessionCreated: false }
>;
