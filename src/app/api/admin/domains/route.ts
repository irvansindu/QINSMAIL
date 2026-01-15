import { NextResponse } from 'next/server';
import { addDomain, deleteDomain, getDomains } from '@/lib/domains';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getToken(request: Request): string {
  const h = request.headers;
  const direct = h.get('x-admin-token') || '';
  if (direct) return direct;
  const auth = h.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || '';
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

export async function GET(request: Request) {
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected) return unauthorized();
  const token = getToken(request);
  if (token !== expected) return unauthorized();
  const domains = await getDomains();
  return NextResponse.json({ ok: true, domains });
}

export async function POST(request: Request) {
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected) return unauthorized();
  const token = getToken(request);
  if (token !== expected) return unauthorized();
  try {
    const body = (await request.json()) as { domain?: string };
    const domains = await addDomain(body?.domain || '');
    return NextResponse.json({ ok: true, domains });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'bad-request';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected) return unauthorized();
  const token = getToken(request);
  if (token !== expected) return unauthorized();
  try {
    const body = (await request.json()) as { domain?: string };
    const domains = await deleteDomain(body?.domain || '');
    return NextResponse.json({ ok: true, domains });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'bad-request';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
