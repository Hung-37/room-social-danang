type JobHandler<T> = () => Promise<T>;

let active = false;
let startedAt: string | null = null;

export function getCollectorJobStatus() {
  return { active, startedAt };
}

export async function withCollectorJobLock<T extends Response>(handler: JobHandler<T>) {
  if (active) {
    return new Response(JSON.stringify({ error: 'Collector đang chạy. Vui lòng chờ job hiện tại hoàn tất.', startedAt }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' }
    }) as T;
  }
  active = true;
  startedAt = new Date().toISOString();
  try {
    return await handler();
  } finally {
    active = false;
    startedAt = null;
  }
}
