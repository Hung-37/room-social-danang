/** Notify UI consumers after the server accepts an account change. */
export function notifySessionChanged(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("room-danang-auth");
    localStorage.removeItem("room-danang-user");
  } catch {
    /* Storage can be disabled; server cookies still work. */
  }
  window.dispatchEvent(new Event("account-session-changed"));
}

export async function signOut(): Promise<void> {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) throw new Error("Chưa thể đăng xuất. Hãy thử lại.");
  notifySessionChanged();
}
