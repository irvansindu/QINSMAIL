import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const base = process.env.GMAIL_USER || '';
  if (!base) {
    return NextResponse.json({ ok: false, error: 'GMAIL_USER is not set' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, base });
}
