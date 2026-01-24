import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get('to');
  const intervalMs = Math.max(3000, Math.min(15000, Number(searchParams.get('interval')) || 5000));
  const plan = (searchParams.get('plan') || 'free').toLowerCase();
  if (!to) {
    return new Response('missing to', { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (type: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${type}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let timer: NodeJS.Timeout | null = null;
      let alive = true;

      const poll = async () => {
        try {
          const res = await fetch(`${new URL(req.url).origin}/api/inbox?to=${encodeURIComponent(to)}&plan=${encodeURIComponent(plan)}`, { cache: 'no-store' });
          if (!res.ok) throw new Error(`bad status ${res.status}`);
          const json = await res.json();
          if (json?.ok) {
            send('messages', json.data || []);
          } else if (json && (json.retryAfter || typeof json.retryAfterMs === 'number')) {
            send('rate_limit', { error: json?.error || 'rate_limited', retryAfter: json.retryAfter, retryAfterMs: json.retryAfterMs });
          } else {
            send('error', json?.error || 'unknown');
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'poll-failed';
          send('error', msg);
        }
      };

      // initial open
      controller.enqueue(encoder.encode('retry: 3000\n\n'));
      send('open', { ok: true });
      poll();
      timer = setInterval(() => { if (alive) poll(); }, intervalMs);

      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: 1\n\n`));
      }, 25000);

      return () => {
        alive = false;
        if (timer) clearInterval(timer);
        clearInterval(keepAlive);
      };
    },
    cancel() {}
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

