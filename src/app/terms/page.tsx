import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function TermsPage() {
  const settings = await getSettings();
  const text = settings.termsText || '';

  return (
    <main className="min-h-screen bg-[#0b0613] text-white p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Terms & Conditions</h1>
        {text ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-white/80 whitespace-pre-wrap leading-relaxed">{text}</div>
          </div>
        ) : (
          <div className="text-white/60">Belum diisi oleh admin.</div>
        )}
      </div>
    </main>
  );
}
