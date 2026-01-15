import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === '/' ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/upgrade'
  ) {
    return NextResponse.next();
  }

  const seg = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (!seg || seg.includes('/')) return NextResponse.next();

  const decoded = (() => {
    try {
      return decodeURIComponent(seg);
    } catch {
      return seg;
    }
  })();

  if (!decoded.includes('@')) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/';
  url.searchParams.set('addr', decoded);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
