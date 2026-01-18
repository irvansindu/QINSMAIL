import { NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

export interface InboxItem {
  id: string;
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

  try {
    const gmail = getGmailClient();
    
    // Search for messages sent to the specific address
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: `to:${to}`,
      maxResults: 20,
    });

    const messages = listRes.data.messages || [];
    const result: InboxItem[] = [];

    for (const msgInfo of messages) {
      if (!msgInfo.id) continue;
      
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: msgInfo.id,
        format: 'full',
      });

      const payload = msg.data.payload;
      const headers = payload?.headers || [];
      
      const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '(no subject)';
      const dateStr = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';
      const dateIso = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

      let text = '';
      let html = '';

      // Helper to extract body
      const getBody = (part: { body?: { data?: string }; mimeType?: string; parts?: any[] }) => {
        if (part.body?.data) {
          const body = Buffer.from(part.body.data, 'base64').toString('utf8');
          if (part.mimeType === 'text/plain') text += body;
          else if (part.mimeType === 'text/html') html += body;
        }
        if (part.parts) {
          part.parts.forEach(getBody);
        }
      };

      if (payload) getBody(payload);

      result.push({
        id: msgInfo.id,
        from,
        subject,
        date: dateIso,
        text,
        html,
      });
    }

    // Sort by date newest first
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ ok: true, data: result });
  } catch (e: unknown) {
    console.error('Gmail API Error:', e);
    const message = e instanceof Error ? e.message : 'Gmail API error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
