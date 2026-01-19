import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function shortNameFromTitle(title: string): string {
  const t = (title || '').trim();
  if (!t) return 'App';
  return t.length > 12 ? t.slice(0, 12) : t;
}

export async function GET() {
  const s = await getSettings();

  const manifest = {
    name: s.siteTitle,
    short_name: shortNameFromTitle(s.siteTitle),
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    description: s.siteDescription,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
