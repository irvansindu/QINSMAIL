'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type ApiResp = { ok: boolean; domains?: string[]; error?: string };
type SettingsResp = {
  ok: boolean;
  settings?: {
    accessGateEnabled?: boolean;
    maintenanceMode?: boolean;
    siteTitle?: string;
    siteDescription?: string;
    logoUrl?: string;
    faviconUrl?: string;
  };
  stats?: {
    totalDomains: number;
    maintenanceMode: boolean;
    accessGateEnabled: boolean;
    gmailApiStatus: string;
    storageType: string;
    nodeVersion: string;
  };
  error?: string;
};

export default function AdminPage() {
  const [tokenInput, setTokenInput] = useState('');
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [accessGateEnabled, setAccessGateEnabled] = useState<boolean>(true);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<SettingsResp['stats'] | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token.trim()) h['x-admin-token'] = token.trim();
    return h;
  }, [token]);

  const load = async (overrideToken?: string) => {
    setLoading(true);
    setError('');
    try {
      const h: Record<string, string> = { 'Content-Type': 'application/json' };
      const effective = (overrideToken ?? token).trim();
      if (effective) h['x-admin-token'] = effective;
      const [resDomains, resSettings, resStats] = await Promise.all([
        fetch('/api/admin/domains', { headers: h }),
        fetch('/api/admin/settings', { headers: h }),
        fetch('/api/admin/stats', { headers: h }),
      ]);

      const jsonDomains = (await resDomains.json().catch(() => ({ ok: false }))) as ApiResp;
      if (!jsonDomains.ok) throw new Error(jsonDomains.error || 'unauthorized');
      setDomains(jsonDomains.domains || []);

      const jsonSettings = (await resSettings.json().catch(() => ({ ok: false }))) as SettingsResp;
      if (jsonSettings.ok) {
        const s = jsonSettings.settings;
        if (typeof s?.accessGateEnabled === 'boolean') setAccessGateEnabled(s.accessGateEnabled);
        if (typeof s?.maintenanceMode === 'boolean') setMaintenanceMode(s.maintenanceMode);
        if (typeof s?.siteTitle === 'string') setSiteTitle(s.siteTitle);
        if (typeof s?.siteDescription === 'string') setSiteDescription(s.siteDescription);
        if (typeof s?.logoUrl === 'string') setLogoUrl(s.logoUrl);
        if (typeof s?.faviconUrl === 'string') setFaviconUrl(s.faviconUrl);
      }

      const jsonStats = (await resStats.json().catch(() => ({ ok: false }))) as SettingsResp;
      if (jsonStats.ok && jsonStats.stats) {
        setStats(jsonStats.stats);
      }

      setAuthed(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed';
      setError(msg);
      setDomains([]);
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  };

  const onLogin = async () => {
    if (!tokenInput.trim()) {
      setError('Masukkan admin token');
      return;
    }
    const t = tokenInput.trim();
    setToken(t);
    await load(t);
  };

  const onLogout = () => {
    setAuthed(false);
    setToken('');
    setTokenInput('');
    setDomains([]);
    setDomainInput('');
    setAccessGateEnabled(true);
    setMaintenanceMode(false);
    setSiteTitle('');
    setSiteDescription('');
    setLogoUrl('');
    setFaviconUrl('');
    setError('');
  };

  const saveBranding = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          siteTitle: siteTitle.trim(),
          siteDescription: siteDescription.trim(),
          logoUrl: logoUrl.trim(),
          faviconUrl: faviconUrl.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({ ok: false }))) as SettingsResp;
      if (!json.ok) throw new Error(json.error || 'failed');
      const s = json.settings;
      if (typeof s?.siteTitle === 'string') setSiteTitle(s.siteTitle);
      if (typeof s?.siteDescription === 'string') setSiteDescription(s.siteDescription);
      if (typeof s?.logoUrl === 'string') setLogoUrl(s.logoUrl);
      if (typeof s?.faviconUrl === 'string') setFaviconUrl(s.faviconUrl);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const setGate = async (enabled: boolean) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ accessGateEnabled: enabled }),
      });
      const json = (await res.json().catch(() => ({ ok: false }))) as SettingsResp;
      if (!json.ok) throw new Error(json.error || 'failed');
      const val = json.settings?.accessGateEnabled;
      if (typeof val === 'boolean') setAccessGateEnabled(val);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const setMaintenance = async (enabled: boolean) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ maintenanceMode: enabled }),
      });
      const json = (await res.json().catch(() => ({ ok: false }))) as SettingsResp;
      if (!json.ok) throw new Error(json.error || 'failed');
      const val = json.settings?.maintenanceMode;
      if (typeof val === 'boolean') setMaintenanceMode(val);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onAdd = async () => {
    if (!domainInput.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/domains', {
        method: 'POST',
        headers,
        body: JSON.stringify({ domain: domainInput.trim() }),
      });
      const json = (await res.json().catch(() => ({ ok: false }))) as ApiResp;
      if (!json.ok) throw new Error(json.error || 'failed');
      setDomains(json.domains || []);
      setDomainInput('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (domain: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/domains', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ domain }),
      });
      const json = (await res.json().catch(() => ({ ok: false }))) as ApiResp;
      if (!json.ok) throw new Error(json.error || 'failed');
      setDomains(json.domains || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden p-4 md:p-10 bg-[#0b0613]">
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          backgroundImage:
            'radial-gradient(900px 450px at 50% 0%, rgba(236,72,153,0.45), transparent 60%), radial-gradient(700px 420px at 85% 25%, rgba(168,85,247,0.40), transparent 55%), radial-gradient(700px 450px at 15% 35%, rgba(244,63,94,0.35), transparent 60%), linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(236,72,153,0.08) 35%, rgba(244,63,94,0.06) 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.30] mix-blend-overlay"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.08) 12.5%, transparent 12.5%, transparent 50%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.08) 62.5%, transparent 62.5%, transparent 100%)',
          backgroundSize: '44px 44px',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Admin Panel</h1>
            <div className="text-xs sm:text-sm text-fuchsia-200/80">QINZ STORE theme</div>
          </div>
          <Link href="/" className="text-sm font-medium text-fuchsia-200 hover:text-fuchsia-100">Kembali</Link>
        </div>

        {authed && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="text-[10px] uppercase tracking-wider text-fuchsia-200/50 mb-1">Total Domain</div>
              <div className="text-xl font-bold text-white">{stats.totalDomains}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="text-[10px] uppercase tracking-wider text-fuchsia-200/50 mb-1">Gmail API</div>
              <div className={`text-sm font-semibold ${stats.gmailApiStatus === 'Connected' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.gmailApiStatus}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="text-[10px] uppercase tracking-wider text-fuchsia-200/50 mb-1">Penyimpanan</div>
              <div className="text-sm font-semibold text-white truncate">{stats.storageType}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="text-[10px] uppercase tracking-wider text-fuchsia-200/50 mb-1">Status Sistem</div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </div>
            </div>
          </div>
        )}

        {!authed ? (
          <div className="rounded-3xl p-6 sm:p-7 border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="text-sm text-fuchsia-100/80 mb-2">Masukkan admin token untuk masuk</div>
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Admin Token"
              className="w-full h-11 px-3 sm:px-4 border border-white/10 bg-white/5 text-white rounded-xl placeholder:text-fuchsia-100/40 focus:ring-2 focus:ring-fuchsia-400/60 focus:border-transparent"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={onLogin}
                disabled={loading}
                className="h-11 px-5 rounded-xl text-white font-semibold disabled:opacity-60 bg-linear-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-rose-500 shadow-[0_12px_30px_rgba(236,72,153,0.25)]"
              >
                Masuk
              </button>
            </div>
            {error && (
              <div className="mt-3 text-sm text-rose-200">{error}</div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl p-6 sm:p-7 border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-fuchsia-100/80">Kelola domain</div>
                <div className="text-xs text-white/50">Tambah / hapus domain yang tersedia</div>
              </div>
              <button
                onClick={onLogout}
                className="text-sm font-medium text-fuchsia-200 hover:text-fuchsia-100"
              >
                Logout
              </button>
            </div>

            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="text-sm text-white">Branding</div>
                  <div className="text-xs text-white/60">Ubah nama website, logo, dan favicon</div>
                </div>
                <button
                  onClick={saveBranding}
                  disabled={loading}
                  className="h-10 px-4 rounded-xl text-white font-semibold disabled:opacity-60 bg-linear-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-rose-500"
                >
                  Simpan
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-white/60 mb-1">Nama Website</div>
                  <input
                    value={siteTitle}
                    onChange={(e) => setSiteTitle(e.target.value)}
                    placeholder="QINZ STORE"
                    className="w-full h-11 px-3 sm:px-4 border border-white/10 bg-white/5 text-white rounded-xl placeholder:text-white/30 focus:ring-2 focus:ring-fuchsia-400/60 focus:border-transparent"
                  />
                </div>
                <div>
                  <div className="text-xs text-white/60 mb-1">Deskripsi Website</div>
                  <input
                    value={siteDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    placeholder="Layanan email sementara sekali pakai"
                    className="w-full h-11 px-3 sm:px-4 border border-white/10 bg-white/5 text-white rounded-xl placeholder:text-white/30 focus:ring-2 focus:ring-fuchsia-400/60 focus:border-transparent"
                  />
                </div>
                <div>
                  <div className="text-xs text-white/60 mb-1">Logo URL (opsional)</div>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://.../logo.png"
                    className="w-full h-11 px-3 sm:px-4 border border-white/10 bg-white/5 text-white rounded-xl placeholder:text-white/30 focus:ring-2 focus:ring-fuchsia-400/60 focus:border-transparent"
                  />
                </div>
                <div>
                  <div className="text-xs text-white/60 mb-1">Favicon URL</div>
                  <input
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="/icon.svg atau https://.../favicon.ico"
                    className="w-full h-11 px-3 sm:px-4 border border-white/10 bg-white/5 text-white rounded-xl placeholder:text-white/30 focus:ring-2 focus:ring-fuchsia-400/60 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-3 text-[11px] text-white/40">Setelah simpan, refresh halaman depan untuk melihat perubahan.</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-white">Kode akses</div>
                    <div className="text-xs text-white/60">Gate Premium</div>
                  </div>
                  <button
                    onClick={() => setGate(!accessGateEnabled)}
                    disabled={loading}
                    className={`relative h-9 w-[80px] rounded-full text-xs font-bold tracking-wide transition disabled:opacity-60 border border-white/10 shadow-inner ${
                      accessGateEnabled
                        ? 'bg-linear-to-r from-fuchsia-600 via-pink-600 to-rose-600 text-white'
                        : 'bg-white/5 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-7 w-7 rounded-full bg-white/90 shadow transition-transform ${
                        accessGateEnabled ? 'translate-x-[42px]' : 'translate-x-0'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="relative z-10">{accessGateEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-white">Maintenance</div>
                    <div className="text-xs text-white/60">Tutup website</div>
                  </div>
                  <button
                    onClick={() => setMaintenance(!maintenanceMode)}
                    disabled={loading}
                    className={`relative h-9 w-[80px] rounded-full text-xs font-bold tracking-wide transition disabled:opacity-60 border border-white/10 shadow-inner ${
                      maintenanceMode
                        ? 'bg-linear-to-r from-amber-600 to-orange-600 text-white'
                        : 'bg-white/5 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-7 w-7 rounded-full bg-white/90 shadow transition-transform ${
                        maintenanceMode ? 'translate-x-[42px]' : 'translate-x-0'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="relative z-10">{maintenanceMode ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="contoh: example.com"
                className="flex-1 h-11 px-3 sm:px-4 border border-white/10 bg-white/5 text-white rounded-xl placeholder:text-fuchsia-100/40 focus:ring-2 focus:ring-fuchsia-400/60 focus:border-transparent"
              />
              <button
                onClick={onAdd}
                disabled={loading}
                className="h-11 px-4 rounded-xl text-white font-semibold disabled:opacity-60 bg-linear-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-rose-500"
              >
                Add
              </button>
              <button
                onClick={() => load()}
                disabled={loading}
                className="h-11 px-4 rounded-xl bg-white/5 text-white/90 hover:bg-white/10 disabled:opacity-60 border border-white/10"
              >
                Refresh
              </button>
            </div>

            {error && (
              <div className="mt-3 text-sm text-rose-200">{error}</div>
            )}

            <div className="mt-5">
              <div className="text-sm text-fuchsia-100/80 mb-2">Domains ({domains.length})</div>
              <div className="space-y-2">
                {domains.map((d) => (
                  <div key={d} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <div className="text-sm text-white/90 break-all">{d}</div>
                    <button
                      onClick={() => onDelete(d)}
                      disabled={loading}
                      className="text-sm font-semibold text-rose-200 hover:text-rose-100 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {domains.length === 0 && (
                  <div className="text-sm text-white/60">Belum ada domain.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
