import { NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const settings = await getSettings();
    const user = settings.gmailUser || process.env.GMAIL_USER;
    const pass = settings.gmailAppPassword || process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      return NextResponse.json({ ok: false, error: 'Gmail user or app password not configured' }, { status: 400 });
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user, pass },
      logger: false,
    });

    try {
      await client.connect();
      await client.mailboxOpen('INBOX');
      await client.logout();
      return NextResponse.json({ ok: true, message: 'IMAP connection successful' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'IMAP connection failed';
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Internal server error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
