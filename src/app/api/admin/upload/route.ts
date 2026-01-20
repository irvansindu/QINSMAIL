import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getToken(request: Request): string {
  const h = request.headers;
  const direct = h.get('x-admin-token') || '';
  if (direct) return direct;
  const auth = h.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m?.[1] || '';
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

function ensureAuth(request: Request): string | null {
  const expected = process.env.ADMIN_TOKEN || '';
  if (!expected) return null;
  const token = getToken(request);
  if (token !== expected) return null;
  return token;
}

function extFromType(type: string): string {
  if (type === 'image/svg+xml') return 'svg';
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/x-icon') return 'ico';
  return 'bin';
}

export async function POST(request: Request) {
  if (!ensureAuth(request)) return unauthorized();

  try {
    const url = new URL(request.url);
    const kind = (url.searchParams.get('kind') || '').toLowerCase();

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'missing-file' }, { status: 400 });
    }

    const mime = file.type || '';
    const size = file.size || 0;

    if (kind === 'favicon') {
      if (mime !== 'image/svg+xml') {
        return NextResponse.json({ ok: false, error: 'favicon-must-be-svg' }, { status: 400 });
      }
      if (size > 250 * 1024) {
        return NextResponse.json({ ok: false, error: 'file-too-large' }, { status: 400 });
      }
    } else if (kind === 'logo') {
      const ok = ['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'].includes(mime);
      if (!ok) {
        return NextResponse.json({ ok: false, error: 'invalid-file-type' }, { status: 400 });
      }
      if (size > 2 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: 'file-too-large' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ ok: false, error: 'invalid-kind' }, { status: 400 });
    }

    const ext = extFromType(mime);
    const safeKind = kind === 'favicon' ? 'favicon' : 'logo';
    const pathname = `branding/${safeKind}-${Date.now()}.${ext}`;

    const blob = await put(pathname, file, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: false,
    });

    return NextResponse.json({ ok: true, url: blob.url });
  } catch {
    return NextResponse.json({ ok: false, error: 'upload-failed' }, { status: 500 });
  }
}
