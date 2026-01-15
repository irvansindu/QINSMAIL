import { NextResponse } from 'next/server';
import { listEmails } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (url.searchParams.get('to') || '').toLowerCase();
  if (!to) return NextResponse.json({ ok: false, error: 'Missing to' }, { status: 400 });
 
  // If Gmail IMAP is configured, proxy to the Gmail-backed route
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (user && pass) {
    try {
      const origin = new URL(req.url).origin;
      const res = await fetch(`${origin}/api/inbox-gmail?to=${encodeURIComponent(to)}`, { cache: 'no-store' });
      const json = await res.json();
      // Normalize to 200; carry ok/error so clients can decide without transport error
      return NextResponse.json(json, { status: 200 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'proxy-failed';
      // Normalize to 200 with ok:false
      return NextResponse.json({ ok: false, error: msg }, { status: 200 });
    }
  }

  // Fallback: local store
  const retentionHours = Number(process.env.FREE_RETENTION_HOURS || 24);
  const data = await listEmails(to, retentionHours);
  return NextResponse.json({ ok: true, data });
}
