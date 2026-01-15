import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function fetchUpstream(url: string) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    cache: 'no-store',
  });
  return res;
}

export async function GET(req: Request) {
  try {
    const incoming = new URL(req.url);
    const query = incoming.search || '';
    const primary = `https://api.1secmail.com/v1/${query}`;
    const fallback = `https://www.1secmail.com/api/v1/${query}`;

    let res = await fetchUpstream(primary);
    if (!res.ok && (res.status === 403 || res.status >= 500)) {
      // retry with fallback host
      res = await fetchUpstream(fallback);
    }

    const text = await res.text();

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status, headers: { 'cache-control': 'no-store' } });
    } catch {
      return new NextResponse(text, { status: res.status, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Proxy error';
    return NextResponse.json(
      { error: true, message },
      { status: 500, headers: { 'cache-control': 'no-store' } }
    );
  }
}
