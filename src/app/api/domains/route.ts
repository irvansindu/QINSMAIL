import { NextResponse } from 'next/server';
import { getDomains } from '@/lib/domains';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const domains = await getDomains();
  return NextResponse.json({ ok: true, domains });
}
