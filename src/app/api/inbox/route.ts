import { NextResponse } from 'next/server';
import { listEmails } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (url.searchParams.get('to') || '').toLowerCase();
  if (!to) return NextResponse.json({ ok: false, error: 'Missing to' }, { status: 400 });
 
  // If Gmail API is configured, proxy to the Gmail-backed route
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const retentionHours = Number(process.env.FREE_RETENTION_HOURS || 1);
  
  if (clientId && clientSecret && refreshToken) {
    try {
      const origin = new URL(req.url).origin;
      const res = await fetch(`${origin}/api/inbox-gmail?to=${encodeURIComponent(to)}&hours=${retentionHours}`, { cache: 'no-store' });
      const json = await res.json();
      return NextResponse.json(json, { status: 200 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'proxy-failed';
      // Normalize to 200 with ok:false
      return NextResponse.json({ ok: false, error: msg }, { status: 200 });
    }
  }

  // Fallback: local store
  const data = await listEmails(to, retentionHours);
  return NextResponse.json({ ok: true, data });
}
