import { NextResponse, type NextResponse as NextResponseType } from 'next/server';
import type { ApiError } from '@/lib/types';

export function apiData<T>(data: T, extra: Record<string, unknown> = {}, init?: ResponseInit) {
  return NextResponse.json({ data, ...extra }, init);
}

export function apiError(message: string, status: number, code?: string, details?: unknown) {
  const body: ApiError = { error: message };
  if (code) body.code = code;
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

export type ApiResponse<T> = NextResponseType<{ data: T }>;
