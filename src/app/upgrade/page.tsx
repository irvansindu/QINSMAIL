"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Shield, Zap, Inbox, Sparkles, Crown } from "lucide-react";

export default function UpgradePage() {
  const checkoutUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const envUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL || process.env.NEXT_PUBLIC_PREMIUM_CHECKOUT_URL || "";
    return envUrl;
  }, []);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onUpgrade = async () => {
    setError("");
    if (!code.trim()) {
      setError("Masukkan kode akses premium");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/validate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data?.ok) {
        setError("Kode tidak valid. Coba lagi.");
        return;
      }
      const url = checkoutUrl || "https://irvanstore.web.id/premium";
      if (typeof window !== "undefined") {
        window.location.href = url;
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-3 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-1 ring-amber-500/20">
            <Crown size={14} /> Premium Plan
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Tingkatkan ke Premium
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
            Nikmati pengalaman bebas batas dengan sinkronisasi lebih cepat, prioritas inbox, dan fitur-fitur ekstra untuk pengguna serius.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-8">
          <div className="rounded-2xl p-6 bg-white/60 dark:bg-white/5 ring-1 ring-gray-900/10 dark:ring-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2 text-gray-800 dark:text-white">
              <Sparkles size={16} />
              <h3 className="font-semibold">Gratis</h3>
            </div>
            <div className="text-3xl font-bold mb-4">Rp0</div>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> Email sementara cepat</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> Auto-refresh standar</li>
              <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> UI mobile-first</li>
            </ul>
          </div>

          <div className="rounded-2xl p-6 border-2 border-amber-500/50 bg-amber-50/40 dark:bg-amber-500/5 dark:border-amber-500/40">
            <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-300">
              <Crown size={16} />
              <h3 className="font-semibold">Premium</h3>
            </div>
            <div className="text-3xl font-bold mb-4">Mulai dari Rp25.000/bln</div>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-center gap-2"><Zap size={14} className="text-amber-500" /> Interval sinkronisasi lebih cepat</li>
              <li className="flex items-center gap-2"><Inbox size={14} className="text-amber-500" /> Prioritas pemrosesan inbox</li>
              <li className="flex items-center gap-2"><Shield size={14} className="text-amber-500" /> Keandalan dan dukungan prioritas</li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl p-6 flex flex-col items-center text-center bg-white/60 dark:bg-white/5 ring-1 ring-gray-900/10 dark:ring-white/10 backdrop-blur-sm">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Dapatkan akses penuh ke fitur premium untuk produktivitas maksimal.
          </div>
          <div className="w-full max-w-sm mx-auto text-left mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kode Akses Premium
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { onUpgrade(); } }}
              placeholder="Masukkan kode (mis. IRVAN-777)"
              className="w-full h-11 px-3 sm:px-4 border dark:border-gray-700 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            {error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onUpgrade}
              disabled={submitting}
              className={`h-11 px-5 rounded-lg text-white transition-colors shadow-md hover:shadow-lg ${submitting ? 'bg-amber-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'}`}
            >
              Upgrade Sekarang
            </button>
            <Link href="/" className="h-11 px-5 rounded-lg bg-gray-200/80 hover:bg-gray-200 dark:bg-gray-700/80 dark:hover:bg-gray-700 dark:text-white transition-colors shadow-md flex items-center">
              Kembali
            </Link>
          </div>
          {!checkoutUrl && (
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Atur URL checkout dengan variabel lingkungan <code>NEXT_PUBLIC_CHECKOUT_URL</code>.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
