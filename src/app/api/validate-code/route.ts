import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    const raw = process.env.PREMIUM_ACCESS_CODES || '';
    const allowed = raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const ok = typeof code === 'string' && allowed.includes(code.trim());
    return NextResponse.json({ ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
