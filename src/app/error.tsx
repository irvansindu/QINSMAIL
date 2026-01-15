'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Terjadi Kesalahan (500)</h1>
        <p style={{ opacity: 0.8, marginBottom: 16 }}>Maaf, terjadi kesalahan saat memuat halaman.</p>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#111827', color: '#e5e7eb', padding: '12px 16px', borderRadius: 8, overflowX: 'auto' }}>
          {error?.message || 'Unknown error'}
          {error?.digest ? `\nDigest: ${error.digest}` : ''}
        </pre>
        <button
          onClick={() => reset()}
          style={{ marginTop: 16, background: '#3b82f6', color: 'white', padding: '8px 12px', borderRadius: 8 }}
        >
          Coba Muat Ulang
        </button>
      </div>
    </div>
  );
}
