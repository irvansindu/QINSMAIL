import { NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/settings';

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

function ensureAuth(request: Request): string | null {
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected) return null;
  const token = getToken(request);
  if (token !== expected) return null;
  return token;
}

export async function GET(request: Request) {
  if (!ensureAuth(request)) return unauthorized();
  const settings = await getSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: Request) {
  if (!ensureAuth(request)) return unauthorized();
  try {
    const body = (await request.json()) as { accessGateEnabled?: boolean; maintenanceMode?: boolean };
    const settings = await updateSettings({
      accessGateEnabled: body?.accessGateEnabled,
      maintenanceMode: body?.maintenanceMode,
    });
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 });
  }
}
