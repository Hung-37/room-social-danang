// A checklist of explicit response protections on one successful page load.
export function assessPageResponse(response) {
  if (!response.ok) throw new Error("Chưa tải được trang chủ để đánh giá.");
  const header = name => (response.headers.get(name) ?? "").toLowerCase().trim();
  const https = new URL(response.url).protocol === "https:";
  const hsts = /(?:^|;)\s*max-age=(\d+)\s*(?:;|$)/.exec(header("strict-transport-security"));
  const directives = header("content-security-policy").split(";").map(s => s.trim().split(/\s+/));
  const scripts = directives.find(([name]) => name === "script-src") ?? directives.find(([name]) => name === "default-src");
  const checks = [
    { label: "Trang được tải qua HTTPS", pass: https },
    { label: "HSTS có thời hạn dương", pass: https && Number(hsts?.[1] ?? 0) > 0 },
    { label: "CSP giới hạn nguồn script", pass: Boolean(scripts?.length > 1 && scripts.slice(1).every(value => !["*", "'unsafe-inline'", "http:", "https:", "data:"].includes(value))) },
    { label: "Chặn trình duyệt đoán kiểu nội dung", pass: header("x-content-type-options") === "nosniff" },
    { label: "Hạn chế trang khác nhúng trang chủ", pass: ["deny", "sameorigin"].includes(header("x-frame-options")) || directives.some(([name, ...sources]) => name === "frame-ancestors" && sources.length === 1 && ["'none'", "'self'"].includes(sources[0])) },
  ];
  return { checks, score: checks.filter(check => check.pass).length };
}
