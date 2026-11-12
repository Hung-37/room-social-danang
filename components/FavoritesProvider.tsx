"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
type Favorites = {
  ids: Set<string>;
  loading: boolean;
  toggle: (id: string, saved: boolean) => Promise<void>;
};
const Context = createContext<Favorites | null>(null);
export default function FavoritesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [ids, setIds] = useState(new Set<string>()),
    [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const sessionGeneration = useRef(0);
  const pending = useRef(new Set<string>());
  const refresh = useCallback(async () => {
    const gen = ++generation.current;
    setLoading(true);
    try {
      const r = await fetch("/api/favorites", { cache: "no-store" });
      const p = await r.json();
      if (gen === generation.current) {
        if (r.ok) setIds(new Set(p.data.map((v: { id: string }) => v.id)));
        else if (r.status === 401) setIds(new Set());
      }
    } catch {
      // Keep the last confirmed selection during a temporary network failure.
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    const sessionChanged = () => {
      sessionGeneration.current++;
      setIds(new Set());
      void refresh();
    };
    window.addEventListener("account-session-changed", sessionChanged);
    window.addEventListener("favorites-updated", listener);
    window.addEventListener("focus", listener);
    return () => {
      generation.current++;
      sessionGeneration.current++;
      window.removeEventListener("account-session-changed", sessionChanged);
      window.removeEventListener("favorites-updated", listener);
      window.removeEventListener("focus", listener);
    };
  }, [refresh]);
  async function toggle(id: string, saved: boolean) {
    if (pending.current.has(id))
      throw new Error("Đang lưu thay đổi. Vui lòng đợi.");
    pending.current.add(id);
    const session = sessionGeneration.current;
    try {
      const r = await fetch("/api/favorites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, saved }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      if (session === sessionGeneration.current) {
        // Reads started before this confirmed write may contain an older snapshot.
        generation.current++;
        setLoading(false);
        setIds((current) => {
          const next = new Set(current);
          if (saved) next.add(id);
          else next.delete(id);
          return next;
        });
      }
    } finally {
      pending.current.delete(id);
    }
  }
  return (
    <Context.Provider value={{ ids, loading, toggle }}>
      {children}
    </Context.Provider>
  );
}
export function useFavorites() {
  const value = useContext(Context);
  if (!value) throw new Error("FavoritesProvider is required.");
  return value;
}
