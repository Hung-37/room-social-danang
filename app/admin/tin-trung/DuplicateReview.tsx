"use client";

import { useEffect, useState } from "react";

const endpoint = "/api/admin/listings/duplicate-audit";
type Plan = {
  revision: string;
  blocked: number;
  actions: { keep: string; hide: { id: string }[] }[];
};

export default function DuplicateReview() {
  const [plan, setPlan] = useState<Plan>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setPlan(undefined);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setPlan(payload.meta.plan);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa tải được báo cáo.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function archive() {
    if (!plan || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: plan.revision }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setMessage(`Đã ẩn ${payload.data.hidden} bản sao trong ${payload.data.groups} nhóm.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chưa thể ẩn bản sao.");
    } finally {
      await load();
      setBusy(false);
    }
  }

  const count = plan?.actions.reduce((sum, item) => sum + item.hide.length, 0) ?? 0;
  return (
    <>
      <p role="status">{message}</p>
      {plan && (
        <>
          <p>{plan.actions.length} nhóm có thể xử lý · {count} bản sao</p>
          {plan.blocked > 0 && <p>{plan.blocked} nhóm cần rà soát riêng.</p>}
          <button className="primary-btn" disabled={busy || !count || Boolean(plan.blocked)} onClick={archive}>
            Ẩn các bản sao
          </button>
          <details>
            <summary>Danh sách mã tin được giữ</summary>
            <ul>{plan.actions.map(({ keep }) => <li key={keep}>{keep}</li>)}</ul>
          </details>
        </>
      )}
    </>
  );
}
