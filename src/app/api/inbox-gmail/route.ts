import { NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/gmail';
import { gmail_v1 } from 'googleapis';

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
  const hours = Number(url.searchParams.get('hours') || 24);
  if (!to) return NextResponse.json({ ok: false, error: 'Missing to' }, { status: 400 });

  try {
    const gmail = getGmailClient();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
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
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const headers = msg.data.payload?.headers || [];
      const dateStr = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';
      const dateIso = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
      const msgDate = new Date(dateIso);

      // Skip and auto-delete if older than retention hours
      if (msgDate < cutoff) {
        try {
          await gmail.users.messages.delete({ userId: 'me', id: msgInfo.id });
        } catch (delErr) {
          console.error(`Failed to auto-delete expired message ${msgInfo.id}:`, delErr);
        }
        continue;
      }

      // Fetch full content for valid messages
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msgInfo.id,
        format: 'full',
      });

      const payload = fullMsg.data.payload as gmail_v1.Schema$MessagePart;
      const fullHeaders = payload?.headers || [];
      
      const from = fullHeaders.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const subject = fullHeaders.find(h => h.name?.toLowerCase() === 'subject')?.value || '(no subject)';

      let text = '';
      let html = '';

      // Helper to extract body
      const getBody = (part: gmail_v1.Schema$MessagePart) => {
        const bodyData = part.body?.data;
        if (bodyData) {
          const body = Buffer.from(bodyData, 'base64').toString('utf8');
          if (part.mimeType === 'text/plain') text += body;
          else if (part.mimeType === 'text/html') html += body;
        }
        if (part.parts) {
          part.parts.forEach((p) => getBody(p));
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
