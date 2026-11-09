import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'disabled',
    message: 'Server-start collection is disabled. Use the scheduled collector or run it from Admin.'
  }, { status: 410 });
}
