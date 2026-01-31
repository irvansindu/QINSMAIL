import { NextResponse } from 'next/server';
import { getDomains, replaceDomains } from '@/lib/domains';
import { getSettings, updateSettings, type AppSettings } from '@/lib/settings';

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

type BackupPayload = {
  version: 1;
  exportedAt: string;
  settings: AppSettings;
  domains: string[];
};

export async function GET(request: Request) {
  if (!ensureAuth(request)) return unauthorized();

  const [settings, domains] = await Promise.all([getSettings(), getDomains()]);
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    domains,
  };

  return NextResponse.json({ ok: true, backup: payload }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!ensureAuth(request)) return unauthorized();

  try {
    const body = (await request.json()) as unknown;

    const maybe = body as { backup?: unknown };
    const backup = (maybe && typeof maybe === 'object' && 'backup' in maybe ? maybe.backup : body) as unknown;

    const b = backup as Partial<BackupPayload> | null;
    if (!b || typeof b !== 'object') {
      return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 });
    }

    const domainsRaw = (b as any).domains as unknown;
    const settingsRaw = (b as any).settings as unknown;

    if (!Array.isArray(domainsRaw) || !settingsRaw || typeof settingsRaw !== 'object') {
      return NextResponse.json({ ok: false, error: 'invalid-backup' }, { status: 400 });
    }

    const [domains, settings] = await Promise.all([
      replaceDomains(domainsRaw),
      updateSettings(settingsRaw as Partial<AppSettings>),
    ]);

    return NextResponse.json({ ok: true, domains, settings });
  } catch {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 });
  }
}
