'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0b0b', color: '#e5e7eb', padding: '2rem' }}>
          <div style={{ maxWidth: 720 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Terjadi Kesalahan (Global)</h1>
            <p style={{ opacity: 0.8, marginBottom: 16 }}>Aplikasi mengalami kesalahan saat memuat.</p>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#111827', padding: '12px 16px', borderRadius: 8, overflowX: 'auto' }}>
              {error?.message || 'Unknown error'}
              {error?.digest ? `\nDigest: ${error.digest}` : ''}
            </pre>
            <button onClick={() => reset()} style={{ marginTop: 16, background: '#3b82f6', color: 'white', padding: '8px 12px', borderRadius: 8 }}>
              Coba Muat Ulang
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
