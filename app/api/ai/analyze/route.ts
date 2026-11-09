import { NextResponse } from 'next/server';
import { analyzeWithOllama } from '@/lib/ollama';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > 12_000) {
    return NextResponse.json({ error: 'text là bắt buộc và tối đa 12.000 ký tự.' }, { status: 400 });
  }

  try {
    return NextResponse.json({ data: await analyzeWithOllama(text), provider: 'ollama-local' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể gọi Ollama local.' }, { status: 503 });
  }
}