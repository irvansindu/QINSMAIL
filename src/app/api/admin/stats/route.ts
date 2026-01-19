import { NextResponse } from 'next/server';
import { getDomains } from '@/lib/domains';
import { getSettings } from '@/lib/settings';

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

  try {
    const [domains, settings] = await Promise.all([
      getDomains(),
      getSettings(),
    ]);

    const gmailConfigured = Boolean(
      process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN
    );

    return NextResponse.json({
      ok: true,
      stats: {
        totalDomains: domains.length,
        maintenanceMode: settings.maintenanceMode,
        accessGateEnabled: settings.accessGateEnabled,
        gmailApiStatus: gmailConfigured ? 'Connected' : 'Not Configured',
        storageType: process.env.KV_REST_API_URL ? 'Vercel KV' : 'Local SQLite/JSON',
        nodeVersion: process.version,
      },
    });
  } catch (error) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ ok: false, error: 'failed-to-fetch-stats' }, { status: 500 });
  }
}
