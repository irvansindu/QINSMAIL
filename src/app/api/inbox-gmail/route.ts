import { NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/gmail';
import { gmail_v1 } from 'googleapis';

export const dynamic = 'force-dynamic';

type CacheEntry = { exp: number; payload: unknown };
const CACHE_TTL_MS = Number(process.env.GMAIL_INBOX_CACHE_MS || 8000);
const inboxCache = new Map<string, CacheEntry>();

function cacheGet(key: string): unknown | null {
  const now = Date.now();
  const hit = inboxCache.get(key);
  if (!hit) return null;
  if (hit.exp <= now) {
    inboxCache.delete(key);
    return null;
  }
  return hit.payload;
}

function cacheSet(key: string, payload: unknown) {
  const exp = Date.now() + Math.max(0, CACHE_TTL_MS);
  inboxCache.set(key, { exp, payload });
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      out[cur] = await fn(items[cur]);
    }
  });
  await Promise.all(workers);
  return out;
}

export interface InboxItem {
  id: string;
  from: string;
  subject: string;
  date: string;
  text: string;
  html: string;
}

function extractRetryAfter(message: string): string | null {
  const m = message.match(/Retry after\s+([^\s]+)/i);
  return m?.[1] || null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = (url.searchParams.get('to') || '').toLowerCase();
  const hours = Number(url.searchParams.get('hours') || 24);
  if (!to) return NextResponse.json({ ok: false, error: 'Missing to' }, { status: 400 });

  const cacheKey = `${to}|${hours}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const gmail = getGmailClient();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Search for messages sent to the specific address
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: `to:${to}`,
      maxResults: 10,
    });

    const messages = listRes.data.messages || [];
    const ids = messages.map(m => m.id).filter((v): v is string => Boolean(v));

    const items = await mapLimit(ids, 4, async (id) => {
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });

      const payload = fullMsg.data.payload as gmail_v1.Schema$MessagePart;
      const fullHeaders = payload?.headers || [];
      const dateStr = fullHeaders.find(h => h.name?.toLowerCase() === 'date')?.value || '';
      const dateIso = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
      const msgDate = new Date(dateIso);

      // Skip old messages (no auto-delete here to reduce Gmail API calls)
      if (msgDate < cutoff) return null;

      const from = fullHeaders.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const subject = fullHeaders.find(h => h.name?.toLowerCase() === 'subject')?.value || '(no subject)';

      let text = '';
      let html = '';

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

      const out: InboxItem = {
        id,
        from,
        subject,
        date: dateIso,
        text,
        html,
      };
      return out;
    });

    const result = items.filter((v): v is InboxItem => Boolean(v));

    // Sort by date newest first
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const payload = { ok: true, data: result };
    cacheSet(cacheKey, payload);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e: unknown) {
    console.error('Gmail API Error:', e);
    const message = e instanceof Error ? e.message : 'Gmail API error';
    const maybeCode = (e as { code?: number } | null)?.code;
    const retryAfter = extractRetryAfter(message);

    if (maybeCode === 429 || /rate limit/i.test(message)) {
      const payload = { ok: false, error: message, retryAfter };
      cacheSet(cacheKey, payload);
      return NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
