import { NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export const dynamic = 'force-dynamic';

interface ImapEnvelopeAddress { address?: string }
interface ImapEnvelope { subject?: string; from?: ImapEnvelopeAddress[] }
interface ImapFetched {
  uid?: number | string;
  envelope?: ImapEnvelope;
  internalDate?: Date | string;
  source: Buffer | string;
}

export interface InboxItem {
  id: number;
  from: string;
  subject: string;
  date: string;
  text: string;
  html: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (url.searchParams.get('to') || '').toLowerCase();
  if (!to) return NextResponse.json({ ok: false, error: 'Missing to' }, { status: 400 });

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return NextResponse.json({ ok: false, error: 'Missing GMAIL_USER or GMAIL_APP_PASSWORD' }, { status: 400 });
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');

    const seq = await client.search({ header: { to } });
    // fetch latest 30 (handle false/empty)
    const ids = Array.isArray(seq) ? seq.slice(-30) : [];
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const messages: InboxItem[] = [];
    for await (const msgRaw of client.fetch(ids, { uid: true, envelope: true, internalDate: true, source: true })) {
      const msg = msgRaw as unknown as ImapFetched;
      const parsed = await simpleParser(msg.source as Buffer);
      const uidNum = Number(msg.uid ?? 0);
      const fromList = msg.envelope?.from?.map(a => a.address).filter(Boolean).join(', ') ?? '';
      const from = (parsed as { from?: { text?: string } }).from?.text || fromList || '';
      const subject = (parsed as { subject?: string }).subject || msg.envelope?.subject || '(tanpa subjek)';
      const dateVal = (parsed as { date?: Date }).date || msg.internalDate || new Date();
      const dateIso = new Date(dateVal as unknown as string | number | Date).toISOString();
      const htmlVal = (parsed as { html?: string | boolean }).html;
      messages.push({
        id: uidNum,
        from,
        subject,
        date: dateIso,
        text: (parsed as { text?: string }).text || '',
        html: htmlVal ? (typeof htmlVal === 'string' ? htmlVal : '') : '',
      });
    }

    // sort newest first
    messages.sort((a: InboxItem, b: InboxItem) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ ok: true, data: messages });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'IMAP error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    try { await client.logout(); } catch {}
  }
}
