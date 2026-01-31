'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import axios from 'axios';
import Image from 'next/image';
import Script from 'next/script';
import QRCode from 'qrcode';
import { CopyIcon, RefreshCw, Mail, Inbox, Trash2, Sparkles, Shield, Zap, Smartphone } from 'lucide-react';

const DEFAULT_DOMAINS: string[] = [];

interface Email {
  id: string | number;
  from: string;
  subject: string;
  date: string;
  read?: boolean;
  body?: string;
  htmlBody?: string;
}

export default function Home() {
  const [email, setEmail] = useState(''); // login part
  const [domains, setDomains] = useState<string[]>(DEFAULT_DOMAINS);
  const [selectedDomain, setSelectedDomain] = useState(''); // selected domain
  const domain = selectedDomain ? `@${selectedDomain}` : ''; // computed display domain
  const [domainMenuOpen, setDomainMenuOpen] = useState(false);
  const domainMenuRef = useRef<HTMLDivElement | null>(null);
  const [apiLogin, setApiLogin] = useState(''); 
  const apiDomain = selectedDomain; // use selectedDomain directly
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sseOn] = useState(true);
  const [intervalMs] = useState(10000);
  const [newCount, setNewCount] = useState(0);
  const [savedList, setSavedList] = useState<string[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [lastSyncMs, setLastSyncMs] = useState<number | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [backoffUntilMs, setBackoffUntilMs] = useState<number>(0);
  const [accessGateEnabled, setAccessGateEnabled] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessCode, setAccessCode] = useState('');
  const [accessError, setAccessError] = useState('');
  const [accessSubmitting, setAccessSubmitting] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceTitle, setMaintenanceTitle] = useState('Sistem Sedang Diperbarui');
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    'Kami sedang melakukan pemeliharaan rutin untuk meningkatkan layanan. Kami akan segera kembali!'
  );
  const [maintenanceEtaText, setMaintenanceEtaText] = useState('Segera Kembali');
  const [maintenanceContactText, setMaintenanceContactText] = useState('');
  const [maintenanceContactUrl, setMaintenanceContactUrl] = useState('');
  const [siteTitle, setSiteTitle] = useState('Email Sementara');
  const [siteDescription, setSiteDescription] = useState('Layanan email sementara sekali pakai');
  const [logoUrl, setLogoUrl] = useState('');
  const [promoBannerEnabled, setPromoBannerEnabled] = useState(false);
  const [promoBannerText, setPromoBannerText] = useState('');
  const [promoBannerUrl, setPromoBannerUrl] = useState('');
  const [promoBannerVariant, setPromoBannerVariant] = useState<'info' | 'success' | 'warning'>('info');

  const canLoadAdsense =
    !maintenanceMode &&
    !accessChecking &&
    (!accessGateEnabled || accessGranted);

  const adsenseClient =
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-3604122645141902';

  type ToastType = 'success' | 'error' | 'info';
  interface Toast { id: number; text: string; type: ToastType }
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = (text: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2200);
  };

  // domains list is hoisted to module scope as AVAILABLE_DOMAINS

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/domains', { cache: 'no-store' });
        const json = await res.json().catch(() => ({ ok: false }));
        const list = Array.isArray(json?.domains) ? (json.domains as string[]) : [];
        const cleaned = list
          .map((d) => (typeof d === 'string' ? d.trim().toLowerCase() : ''))
          .filter(Boolean);
        if (cancelled) return;
        if (cleaned.length > 0) {
          setDomains(cleaned);
          // Only update selectedDomain if it's currently empty
          if (!selectedDomain) {
            setSelectedDomain(cleaned[0]);
          }
        }
      } catch {}
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers to persist read-state per address (username@domain)
  const currentAddress = (): string | null => {
    const addr = apiLogin && apiDomain ? `${apiLogin}@${apiDomain}`.toLowerCase() : `${email}${domain}`.toLowerCase();
    if (!addr || !addr.includes('@') || addr.endsWith('@')) return null;
    return addr;
  };

  const loadReadIds = (addr: string | null): Set<string | number> => {
    if (!addr) return new Set<string | number>();
    try {
      const raw = localStorage.getItem(`readState:${addr}`);
      if (!raw) return new Set<string | number>();
      const arr = JSON.parse(raw) as (string | number)[];
      return new Set<string | number>(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set<string | number>();
    }
  };

  const saveReadIds = (ids: Set<string | number>, addr: string | null) => {
    if (!addr) return;
    try {
      localStorage.setItem(`readState:${addr}` , JSON.stringify(Array.from(ids)));
    } catch {}
  };

  // Fallback: some backends may return unstable IDs or varying timestamps.
  // Use a stable key based on from + normalized subject only.
  const messageKey = (m: { from: string; subject: string; date: string; id: string | number }): string => {
    const from = (m.from||'').toLowerCase();
    const subjRaw = (m.subject||'').toLowerCase();
    // normalize subject: remove digits and extra spaces to avoid OTP/code differences
    const subj = subjRaw.replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
    return `${from}|${subj}`;
  };

  const loadReadKeys = (addr: string | null): Set<string> => {
    if (!addr) return new Set<string>();
    try {
      const raw = localStorage.getItem(`readStateKeys:${addr}`);
      if (!raw) return new Set<string>();
      const arr = JSON.parse(raw) as string[];
      return new Set<string>(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set<string>();
    }
  };

  const saveReadKeys = (keys: Set<string>, addr: string | null) => {
    if (!addr) return;
    try {
      localStorage.setItem(`readStateKeys:${addr}`, JSON.stringify(Array.from(keys)));
    } catch {}
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        const json = await res.json().catch(() => ({ ok: false }));
        const s = json?.settings;
        if (s) {
          if (typeof s.accessGateEnabled === 'boolean') {
            setAccessGateEnabled(s.accessGateEnabled);
            if (!s.accessGateEnabled) {
              setAccessGranted(true);
            }
          }
          if (typeof s.maintenanceMode === 'boolean') {
            setMaintenanceMode(s.maintenanceMode);
          }
          if (typeof s.maintenanceTitle === 'string') setMaintenanceTitle(s.maintenanceTitle);
          if (typeof s.maintenanceMessage === 'string') setMaintenanceMessage(s.maintenanceMessage);
          if (typeof s.maintenanceEtaText === 'string') setMaintenanceEtaText(s.maintenanceEtaText);
          if (typeof s.maintenanceContactText === 'string') setMaintenanceContactText(s.maintenanceContactText);
          if (typeof s.maintenanceContactUrl === 'string') setMaintenanceContactUrl(s.maintenanceContactUrl);
          if (typeof s.siteTitle === 'string') setSiteTitle(s.siteTitle);
          if (typeof s.siteDescription === 'string') setSiteDescription(s.siteDescription);
          if (typeof s.logoUrl === 'string') setLogoUrl(s.logoUrl);
          if (typeof s.promoBannerEnabled === 'boolean') setPromoBannerEnabled(s.promoBannerEnabled);
          if (typeof s.promoBannerText === 'string') setPromoBannerText(s.promoBannerText);
          if (typeof s.promoBannerUrl === 'string') setPromoBannerUrl(s.promoBannerUrl);
          if (s.promoBannerVariant === 'info' || s.promoBannerVariant === 'success' || s.promoBannerVariant === 'warning') {
            setPromoBannerVariant(s.promoBannerVariant);
          }
        }
      } catch {}
      setAccessChecking(false);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (!domainMenuOpen) return;
    const onDown = (ev: MouseEvent) => {
      const el = domainMenuRef.current;
      if (!el) return;
      if (ev.target instanceof Node && !el.contains(ev.target)) {
        setDomainMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [domainMenuOpen]);

  const handleAccessSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (accessSubmitting) return;
    if (!accessCode.trim()) {
      setAccessError('Masukkan kode akses');
      return;
    }
    setAccessSubmitting(true);
    setAccessError('');
    try {
      const res = await fetch('/api/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: accessCode.trim() }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data?.ok) {
        setAccessError('Kode salah atau kedaluwarsa.');
        return;
      }
      setAccessGranted(true);
    } catch {
      setAccessError('Tidak dapat memverifikasi kode. Coba lagi.');
    } finally {
      setAccessSubmitting(false);
    }
  };

  useEffect(() => {
    if (domains.length === 0) return;

    const init = async () => {
      try {
        if (typeof window === 'undefined') return;
        
        // 1. Check for Deep Link
        const params = new URLSearchParams(window.location.search);
        const candidates = ['addr', 'address', 'email'];
        let raw: string | null = null;
        for (const [k, v] of params.entries()) {
          if (candidates.includes(k.toLowerCase())) { raw = v; break; }
        }
        if (!raw) {
          const path = (window.location.pathname || '').replace(/^\/+/, '');
          if (path && !path.includes('/') && path.includes('@')) {
            raw = path;
          }
        }

        if (raw) {
          let decoded = '';
          try { decoded = decodeURIComponent(raw.replace(/\+/g, '%20')); } catch { decoded = raw; }
          const value = (decoded || '').trim().toLowerCase();
          if (value) {
            let login = '';
            let dom = '';
            if (value.includes('@')) {
              const parts = value.split('@');
              login = (parts[0] || '').replace(/[^a-z0-9._-]/g, '').replace(/^[^a-z0-9]+/, '');
              dom = (parts[1] || '').trim();
            } else {
              login = value.replace(/[^a-z0-9._-]/g, '').replace(/^[^a-z0-9]+/, '');
              dom = domains[0];
            }
            
            if (login && dom) {
              if (!domains.includes(dom)) dom = domains[0];
              setSelectedDomain(dom);
              setEmail(login);
              setApiLogin(login);
              pushToast('Alamat dari tautan diterapkan', 'success');
              return;
            }
          }
        }

        // 2. Check LocalStorage
        const saved = localStorage.getItem('lastUsername');
        const savedDomain = localStorage.getItem('selectedDomain');
        const savedAddrs = localStorage.getItem('savedAddresses');
        if (savedAddrs) {
          try { setSavedList(JSON.parse(savedAddrs)); } catch {}
        }

        if (saved) {
          let dom = savedDomain || domains[0];
          if (!domains.includes(dom)) dom = domains[0];
          
          setSelectedDomain(dom);
          setEmail(saved);
          setApiLogin(saved);
          return;
        }

        // 3. Fallback: Generate Random
        if (!apiLogin || !apiDomain) {
          generateEmail(domains[0]);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains]);

  // Simple beep using Web Audio API (no asset file needed)
  const playBeep = () => {
    try {
      const AnyWindow = window as unknown as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctor = AnyWindow.AudioContext || AnyWindow.webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
      o.start();
      o.stop(ctx.currentTime + 0.22);
    } catch {}
  };

  // Generate QR locally (offline) when modal opens or deep link changes
  useEffect(() => {
    const make = async () => {
      try {
        if (!showQR) return;
        const url = buildDeepLink();
        if (!url) { setQrDataUrl(''); return; }
        const dataUrl = await QRCode.toDataURL(url, {
          errorCorrectionLevel: 'M',
          margin: 2,
          scale: 6,
          color: { dark: '#ffffff', light: '#000000' },
        });
        setQrDataUrl(dataUrl);
      } catch {
        setQrDataUrl('');
      }
    };
    make();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQR, email, domain]);

  const buildDeepLink = (): string => {
    try {
      const addr = `${email}${domain}`.toLowerCase();
      if (!email || !domain || !addr.includes('@')) return '';
      const { origin } = window.location;
      const login = encodeURIComponent((email || '').toLowerCase());
      const dom = encodeURIComponent((domain || '').replace(/^@/, '').toLowerCase());
      return `${origin}/${login}@${dom}`;
    } catch {
      return '';
    }
  };

  const handleCopyLink = async () => {
    try {
      const addr = `${email}${domain}`.toLowerCase();
      if (!email || !domain || !addr.includes('@')) return;
      const { origin } = window.location;
      const login = encodeURIComponent((email || '').toLowerCase());
      const dom = encodeURIComponent((domain || '').replace(/^@/, '').toLowerCase());
      const url = `${origin}/${login}@${dom}`;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      pushToast('Link tersalin', 'success');
    } catch {}
  };

  // Ensure Notification permission (only when needed)
  const ensureNotificationPermission = async () => {
    try {
      if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      const res = await Notification.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  };

  // Generate a random email under selected domain (via ImprovMX inbound)
  const generateEmail = async (overrideDom?: string) => {
    setLoading(true);
    try {
      const randomLogin = Math.random().toString(36).slice(2, 10);
      const dom = overrideDom || selectedDomain;
      if (!dom) return;
      setSelectedDomain(dom);
      setEmail(randomLogin);
      setApiLogin(randomLogin);
      setCopied(false);
      setEmails([]);
      setSelectedEmail(null);
    } finally {
      setLoading(false);
    }
  };

  // Generate stronger random username (12–16 chars)
  const generateStrong = async (overrideDom?: string) => {
    setLoading(true);
    try {
      const len = 12 + Math.floor(Math.random() * 5); // 12..16
      const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let login = '';
      for (let i = 0; i < len; i++) {
        login += charset[Math.floor(Math.random() * charset.length)];
      }
      const dom = overrideDom || selectedDomain;
      if (!dom) return;
      setSelectedDomain(dom);
      setEmail(login);
      setApiLogin(login);
      setCopied(false);
      setEmails([]);
      setSelectedEmail(null);
    } finally {
      setLoading(false);
    }
  };

  // Copy email to clipboard
  const handleCopy = async () => {
    try {
      const text = `${email}${domain}`;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      pushToast('Alamat tersalin', 'success');
    } catch {
      pushToast('Gagal menyalin', 'error');
    }
  };

  // Manually save current username to localStorage
  const handleSaveUsername = () => {
    try {
      if (email) {
        localStorage.setItem('lastUsername', email);
        const addr = `${email}${domain}`.toLowerCase();
        if (addr.includes('@')) {
          const exists = savedList.includes(addr);
          if (!exists) {
            const next = [...savedList, addr];
            setSavedList(next);
            localStorage.setItem('savedAddresses', JSON.stringify(next));
          }
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      pushToast('Username disimpan', 'success');
    } catch {}
  };

  // Handle custom username typing (sanitize) without immediate fetch
  const handleUsernameChange = (val: string) => {
    const sanitized = val.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64);
    // ensure first char is alnum if exists
    const fixed = sanitized.replace(/^[^a-zA-Z0-9]+/, '');
    setEmail(fixed);
    setCopied(false);
  };

  // Fetch emails from ImprovMX-backed local store
  const checkEmails = async (): Promise<boolean> => {
    const full = `${email}${domain}`.toLowerCase();
    if (!email || !domain) return false;
    const showSpinner = emails.length === 0;
    const doPoll = async (showSpinner = false): Promise<boolean> => {
      if (backoffUntilMs && Date.now() < backoffUntilMs) return false;
      if (showSpinner) setLoading(true);
      try {
        interface ApiInboxItem { id: string | number; from: string; subject: string; date: string; text: string; html: string }
        const res = await axios.get<{
          ok: boolean;
          data: ApiInboxItem[];
          error?: string;
          retryAfter?: string;
          retryAfterMs?: number;
        }>(
          `/api/inbox?to=${encodeURIComponent(full)}`
        );
        if (!res.data?.ok) {
          const ra = res.data?.retryAfter;
          const raMs = typeof res.data?.retryAfterMs === 'number' ? res.data.retryAfterMs : undefined;
          const until = ra
            ? new Date(ra).getTime()
            : typeof raMs === 'number'
              ? Date.now() + raMs
              : 0;
          if (until && Number.isFinite(until)) {
            setBackoffUntilMs(until);
          }
          console.warn('Inbox fetch failed:', res.data?.error || 'unknown error');
          return false;
        }
      const list: Email[] = (res.data.data || [])
        .map((m: ApiInboxItem): Email => ({
          id: m.id,
          from: m.from,
          subject: m.subject || '(tanpa subjek)',
          date: m.date,
          read: false,
          body: m.text,
          htmlBody: m.html,
        }))
        .sort((a: Email, b: Email) => (new Date(b.date).getTime() - new Date(a.date).getTime()));
      // Detect new messages compared to current state
      const addrNow = currentAddress();
      const storedRead = loadReadIds(addrNow);
      const storedKeys = loadReadKeys(addrNow);
      const prevIds = new Set<string | number>(emails.map(e => e.id));
      // Only count as "new" if not seen in current state AND not already marked read previously (by id or key)
      const newOnes = list.filter(m => !prevIds.has(m.id) && !storedRead.has(m.id) && !storedKeys.has(messageKey(m)));
      if (newOnes.length > 0) {
        setNewCount(c => c + newOnes.length);
        // mark only new ones as unread, keep existing read flags
        const merged = list.map(m => {
          const existed = prevIds.has(m.id) ? emails.find(e => e.id === m.id) : undefined;
          // If existed: keep previous read OR stored by id OR stored by key
          // If brand-new id: only stored by id applies (do NOT use subject key to mark read)
          const read = existed
            ? (existed.read ?? false) || storedRead.has(m.id) || storedKeys.has(messageKey(m)) || false
            : storedRead.has(m.id) || false;
          return { ...m, read };
        });
        const prevY = typeof window !== 'undefined' ? window.scrollY : 0;
        setEmails(merged);
        // restore scroll to avoid jumpy feel
        try { if (typeof window !== 'undefined') window.scrollTo(0, prevY); } catch {}
        playBeep();
        // Mobile vibration if supported
        try {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            (navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean }).vibrate?.([80, 40, 80]);
          }
        } catch {}
        // Desktop notification if tab not active
        try {
          if (typeof document !== 'undefined' && document.hidden) {
            const ok = await ensureNotificationPermission();
            if (ok && newOnes[0]) {
              const first = newOnes[0];
              const body = `${first.from || 'Pengirim tidak dikenal'}\n${first.subject || 'Pesan baru'}`;
              new Notification('Pesan baru diterima', {
                body,
              });
            }
          }
        } catch {}
      } else {
        // preserve read flags
        const merged = list.map(m => {
          const existed = emails.find(e => e.id === m.id);
          const read = existed
            ? (existed.read ?? false) || storedRead.has(m.id) || storedKeys.has(messageKey(m)) || false
            : storedRead.has(m.id) || false;
          return { ...m, read };
        });
        const prevY = typeof window !== 'undefined' ? window.scrollY : 0;
        setEmails(merged);
        try { if (typeof window !== 'undefined') window.scrollTo(0, prevY); } catch {}
      }
        return true;
      } catch (e) {
        console.error(e);
        return false;
      } finally {
        if (showSpinner) setLoading(false);
      }
    };

    return await doPoll(showSpinner);
  };

  // (Removed) Manual reload — auto refresh runs every 5s.

  // Delete locally (1secmail public API tidak menyediakan delete)
  const deleteEmail = (id: string | number) => {
    setEmails(prev => prev.filter(email => email.id !== id));
    if (selectedEmail && selectedEmail.id === id) {
      setSelectedEmail(null);
    }
  };

  const markAllRead = () => {
    setEmails(prev => prev.map(e => ({ ...e, read: true })));
    setNewCount(0);
    const addr = currentAddress();
    const allIds = new Set<string | number>(emails.map(e => e.id));
    const allKeys = new Set<string>(emails.map(e => messageKey(e)));
    saveReadIds(allIds, addr);
    saveReadKeys(allKeys, addr);
  };


  // Persist username to localStorage so it survives refresh
  useEffect(() => {
    try {
      if (email) localStorage.setItem('lastUsername', email);
    } catch {}
  }, [email]);

  // Persist selected domain to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('selectedDomain', selectedDomain);
    } catch {}
  }, [selectedDomain]);

  // Auto refresh is always on by default.

  const applySavedAddress = (addr: string) => {
    const [login, dom] = addr.split('@');
    if (!login || !dom) return;
    setSelectedDomain(dom);
    setEmail(login);
    setApiLogin(login);
  };

  const deleteSavedAddress = (addr: string) => {
    const next = savedList.filter(a => a !== addr);
    setSavedList(next);
    try { localStorage.setItem('savedAddresses', JSON.stringify(next)); } catch {}
  };

  // Ambil daftar pesan ketika alamat berubah
  useEffect(() => {
    if (apiLogin && apiDomain && !apiDomain.startsWith('@')) {
      checkEmails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiLogin, apiDomain]);

  // Polling interval (always on when address is set)
  useEffect(() => {
    if (!email || !domain) return;
    const doPoll = async () => {
      try {
        setSyncing(true);
        const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        await checkEmails();
        const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const dt = Math.max(0, Math.round(t1 - t0));
        setLastSyncMs(dt);
        try {
          const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSyncAt(ts);
        } catch {}
      } finally {
        setSyncing(false);
      }
    };
    const id = setInterval(() => {
      void doPoll();
    }, intervalMs);
    // Kick one immediately without flashing empty-state spinner
    void doPoll();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, domain, intervalMs, backoffUntilMs]);

  // Realtime via SSE
  useEffect(() => {
    if (!sseOn || !email || !domain) return;
    if (backoffUntilMs && Date.now() < backoffUntilMs) return;
    const addr = `${email}${domain}`.toLowerCase();
    if (!addr.includes('@')) return;
    let closed = false;
    const es = new EventSource(`/api/inbox-stream?to=${encodeURIComponent(addr)}&interval=${intervalMs}`);
    const onMessages = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data || '[]') as { id:number; from:string; subject:string; date:string; text:string; html:string }[];
        // transform to Email[]
        const incoming = (data || []).map(m => ({ id: m.id, from: m.from, subject: m.subject || '(tanpa subjek)', date: m.date, read: false, body: m.text, htmlBody: m.html }));
        if (incoming.length === 0) return;
        // merge
        const addrNow = currentAddress();
        const storedRead = loadReadIds(addrNow);
        const storedKeys = loadReadKeys(addrNow);
        setEmails(prev => {
          const prevMap = new Map(prev.map(e => [e.id, e]));
          const prevIds = new Set(prev.map(p => p.id));

          // First, map incoming and preserve read if existed or stored
          const normalizedIncoming = incoming.map(m => {
            const existed = prevMap.get(m.id);
            return {
              ...m,
              read: (existed?.read ?? false) || storedRead.has(m.id) || storedKeys.has(messageKey(m)) || false,
            } as Email;
          });

          // Then, keep previous items that are not present in incoming (server may send subset)
          const prevOnly = prev.filter(p => !normalizedIncoming.some(i => i.id === p.id));

          // Merge and sort
          const mergedAll = [...normalizedIncoming, ...prevOnly]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          // Update new counter only for actually new, unread items from this batch
          const addedUnread = normalizedIncoming.filter(m => !prevIds.has(m.id) && !m.read).length;
          if (addedUnread > 0) setNewCount(c => c + addedUnread);

          return mergedAll;
        });
      } catch {}
    };
    es.addEventListener('messages', onMessages);

    const onRateLimit = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data || '{}') as { retryAfter?: string; retryAfterMs?: number };
        const until = data.retryAfter ? new Date(data.retryAfter).getTime() : (typeof data.retryAfterMs === 'number' ? Date.now() + data.retryAfterMs : 0);
        if (until && Number.isFinite(until)) setBackoffUntilMs(until);
      } catch {}
      es.close();
    };
    es.addEventListener('rate_limit', onRateLimit);
    const onError = () => { if (!closed) setTimeout(()=>{}, 0); };
    es.addEventListener('error', onError as EventListener);
    return () => { closed = true; es.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseOn, email, domain, intervalMs, backoffUntilMs]);

  return (
    <main className={`relative min-h-screen overflow-hidden p-4 md:p-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] bg-[#0b0613] ${maintenanceMode ? 'h-screen overflow-hidden' : ''}`}>
      {canLoadAdsense && adsenseClient ? (
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClient)}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      ) : null}
      {maintenanceMode ? (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-[#0b0613] p-6 text-center overflow-hidden">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(900px 450px at 50% 0%, rgba(236,72,153,0.3), transparent 60%), radial-gradient(700px 420px at 85% 25%, rgba(168,85,247,0.25), transparent 55%)' }} aria-hidden="true" />
          <div className="relative max-w-md w-full">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6 border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
              <RefreshCw size={40} className="animate-spin-slow" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">{maintenanceTitle}</h1>
            <p className="text-fuchsia-100/60 mb-8 leading-relaxed">{maintenanceMessage}</p>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-fuchsia-400/80 mb-2">Estimasi Selesai</div>
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white inline-block">
              {maintenanceEtaText}
            </div>
            {maintenanceContactText && maintenanceContactUrl ? (
              <div className="mt-6">
                <a
                  href={maintenanceContactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-white/5 border border-white/10 text-white/90 hover:bg-white/10"
                >
                  {maintenanceContactText}
                </a>
              </div>
            ) : null}
            <div className="mt-10 text-sm text-white/40">
              © 2025 <span className="text-fuchsia-300">{siteTitle}</span>
            </div>
          </div>
        </div>
      ) : null}
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
      <div className="relative max-w-6xl mx-auto">
        {promoBannerEnabled && promoBannerText ? (
          <div className="mb-4 fade-in">
            <a
              href={promoBannerUrl || undefined}
              onClick={(e) => {
                if (!promoBannerUrl) e.preventDefault();
              }}
              className={`block rounded-2xl border px-4 py-3 text-sm backdrop-blur-md transition hover:brightness-110 ${
                promoBannerVariant === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-100'
                  : promoBannerVariant === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-100'
                    : 'bg-fuchsia-500/10 border-fuchsia-500/25 text-fuchsia-100'
              } ${promoBannerUrl ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate">{promoBannerText}</div>
                </div>
                {promoBannerUrl ? (
                  <div className="text-xs font-semibold opacity-80">Buka</div>
                ) : null}
              </div>
            </a>
          </div>
        ) : null}
        <div className="flex items-center justify-end mb-4">
        </div>
        <header className="text-center mb-10 fade-in">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-3 text-xs bg-fuchsia-600/10 text-fuchsia-200 ring-1 ring-fuchsia-500/20">
            <Sparkles size={12} /> Cepat, aman, dan sementara
          </div>
          {logoUrl ? (
            <div className="mb-3 flex justify-center">
              <img
                src={logoUrl}
                alt={siteTitle}
                className="h-14 w-14 rounded-2xl object-contain bg-white/5 border border-white/10"
              />
            </div>
          ) : null}
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3 bg-linear-to-r from-fuchsia-300 via-pink-300 to-rose-300 bg-clip-text text-transparent">{siteTitle}</h1>
          <p className="text-white/70 text-sm sm:text-base max-w-2xl mx-auto">{siteDescription}</p>
        </header>

        <section className="mb-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 fade-in fade-in-1">
          <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2 text-blue-400"><Shield size={16} />
              <h3 className="font-semibold">Privasi Terjaga</h3>
            </div>
            <p className="text-sm text-gray-400">Lindungi email utama Anda dari spam dan pelacakan.</p>
          </div>
          <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10 backdrop-blur-sm fade-in fade-in-2">
            <div className="flex items-center gap-2 mb-2 text-violet-400"><Zap size={16} />
              <h3 className="font-semibold">Langsung Siap</h3>
            </div>
            <p className="text-sm text-gray-400">Buat alamat baru dengan sekali klik, tanpa registrasi.</p>
          </div>
          <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10 backdrop-blur-sm fade-in fade-in-3">
            <div className="flex items-center gap-2 mb-2 text-emerald-400"><Smartphone size={16} />
              <h3 className="font-semibold">Nyaman di HP</h3>
            </div>
            <p className="text-sm text-gray-400">Antarmuka mobile-first yang cepat dan intuitif.</p>
          </div>
          <div className="rounded-xl p-4 bg-white/5 ring-1 ring-white/10 backdrop-blur-sm fade-in fade-in-4">
            <div className="flex items-center gap-2 mb-2 text-fuchsia-400"><Inbox size={16} />
              <h3 className="font-semibold">Realtime Inbox</h3>
            </div>
            <p className="text-sm text-gray-400">Notifikasi halus, auto-refresh, dan penanda pesan baru.</p>
          </div>
        </section>

        <div id="generator" className="rounded-3xl p-6 mb-8 border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl">
          <div className="flex flex-col gap-4 md:gap-6 md:grid md:grid-cols-[1fr_auto] md:items-end mb-6">
            <div className="flex-1">
              <div className="mb-4">
                <label className="text-sm font-medium text-fuchsia-100/80 mb-2 flex items-center gap-1.5">
                  <Inbox size={14} className="text-white/60" />
                  Domain
                </label>
                <div ref={domainMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDomainMenuOpen(v => !v)}
                    className="w-full h-11 px-3 sm:px-4 border border-white/10 bg-white/5 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 flex items-center justify-between"
                    aria-haspopup="listbox"
                    aria-expanded={domainMenuOpen}
                  >
                    <span className="truncate">{selectedDomain}</span>
                    <span className="text-white/50">▾</span>
                  </button>
                  {domainMenuOpen && (
                    <div
                      role="listbox"
                      className="absolute z-50 mt-2 w-full max-h-72 overflow-auto rounded-2xl border border-white/10 bg-[#12081f]/95 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
                    >
                      {domains.map((d) => (
                        <button
                          key={d}
                          type="button"
                          role="option"
                          aria-selected={d === selectedDomain}
                          onClick={() => {
                            const newDomain = d;
                            setSelectedDomain(newDomain);
                            setDomainMenuOpen(false);
                            setEmails([]);
                            setSelectedEmail(null);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                            d === selectedDomain
                              ? 'bg-fuchsia-600/25 text-white'
                              : 'text-white/90 hover:bg-white/10'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={email}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  onBlur={() => {
                    if (email) {
                      setApiLogin(email);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="Nama pengguna"
                  className="w-full h-11 px-3 sm:px-4 border border-white/10 bg-white/5 text-white rounded-xl placeholder:text-fuchsia-100/40 focus:ring-2 focus:ring-fuchsia-400/60 focus:border-transparent pr-28"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <span className="text-sm text-white/80 px-2 py-1 rounded-lg bg-white/5 border border-white/10">{domain || ''}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 md:gap-3 flex-col md:flex-col w-full md:w-auto md:self-end md:justify-end">
              <div className="hidden md:flex flex-col items-end mb-1.5">
                <span className="text-xs text-white/60 mb-1 flex items-center gap-1.5"><Mail size={12} className="text-white/40" /> Alamat aktif</span>
                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/90 text-sm">
                  {currentAddress() || '—'}
                </span>
              </div>
              <div className="flex gap-2 md:gap-3 flex-col md:flex-row md:flex-nowrap w-full md:w-auto">
              <button
                onClick={handleCopy}
                className={`w-full md:w-auto h-11 flex items-center justify-center gap-2 px-3 md:px-4 rounded-lg backdrop-blur-sm ${
                  copied ? 'bg-green-500' : 'bg-linear-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-rose-500'
                } text-white transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400`}
              >
                <CopyIcon size={16} />
                {copied ? 'Tersalin!' : 'Salin'}
              </button>
              <button
                onClick={handleCopyLink}
                className={`w-full md:w-auto h-11 flex items-center justify-center gap-2 px-3 md:px-4 rounded-lg backdrop-blur-sm ${
                  linkCopied ? 'bg-green-500' : 'bg-linear-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-rose-500'
                } text-white transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400`}
                title="Salin tautan langsung ke alamat ini"
              >
                {linkCopied ? 'Link Tersalin!' : 'Salin Link'}
              </button>
              <button
                onClick={() => setShowQR(true)}
                disabled={!email || !domain}
                className={`w-full md:w-auto h-11 flex items-center justify-center gap-2 px-3 md:px-4 rounded-lg ${
                  !email || !domain ? 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed' : 'backdrop-blur-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                } transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-400`}
                title="Tampilkan QR Code untuk tautan ini"
              >
                QR Code
              </button>
              <button
                onClick={handleSaveUsername}
                className={`w-full md:w-auto h-11 flex items-center justify-center gap-2 px-3 md:px-4 rounded-lg ${
                  saved ? 'bg-green-600 text-white' : 'backdrop-blur-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                } transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400`}
                title="Simpan username ini"
              >
                {saved ? 'Tersimpan!' : 'Simpan'}
              </button>
              <button
                onClick={() => generateStrong()}
                className="w-full md:w-auto h-11 flex items-center justify-center gap-2 px-3 md:px-4 bg-linear-to-r from-purple-600/90 to-fuchsia-600/90 hover:from-purple-600 hover:to-fuchsia-600 text-white rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-fuchsia-400 backdrop-blur-sm"
                title="Generate username kuat (12–16)"
              >
                Generate Kuat
              </button>
              <button
                onClick={() => generateEmail()}
                className="w-full md:w-auto h-11 flex items-center justify-center gap-2 px-3 md:px-4 backdrop-blur-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-fuchsia-400"
              >
                <RefreshCw size={16} />
                Baru
              </button>
              </div>
            </div>
          </div>
          {savedList.length > 0 && (
            <div className="mb-6 overflow-x-auto">
              <h3 className="text-sm font-medium text-fuchsia-100/80 mb-2 flex items-center gap-1.5"><Inbox size={14} className="text-white/50" /> Alamat Tersimpan</h3>
              <div className="flex flex-nowrap sm:flex-wrap gap-2 min-w-full">
                {savedList.map(addr => (
                  <div
                    key={addr}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-sm cursor-pointer hover:bg-white/10 transition-colors text-white/90"
                    onClick={() => applySavedAddress(addr)}
                    title={addr}
                  >
                    <span className="truncate max-w-[200px] sm:max-w-[220px]">{addr}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSavedAddress(addr); }}
                      className="text-white/40 hover:text-rose-200 transition-colors"
                      title="Hapus dari tersimpan"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        {showQR && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowQR(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-2xl ring-1 ring-white/10 p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">QR Code</h3>
                <button
                  onClick={() => setShowQR(false)}
                  className="text-white/50 hover:text-white transition-colors"
                  title="Tutup"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col items-center gap-3">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    alt="QR Code untuk tautan alamat ini"
                    width={240}
                    height={240}
                    unoptimized
                    className="rounded-xl border border-white/10 shadow"
                  />
                ) : (
                  <div className="w-[240px] h-[240px] flex items-center justify-center rounded-xl border border-white/10 text-xs text-white/60">
                    Membuat QR...
                  </div>
                )}
                <p className="text-xs text-white/60 break-all text-center">
                  {buildDeepLink()}
                </p>
                <button
                  onClick={() => setShowQR(false)}
                  className="mt-2 px-4 py-2 rounded-xl text-white font-semibold bg-linear-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-rose-500 shadow-sm"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
              <Inbox size={20} /> Kotak Masuk
              {emails.length > 0 && (
                <span className="bg-white/5 border border-white/10 text-white text-xs px-2 py-1 rounded-full">
                  {emails.length}
                </span>
              )}
              {newCount > 0 && (
                <span className="ml-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                  Baru {newCount}
                </span>
              )}
              {syncing && (
              <span className="ml-2 inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-white/70 ring-1 ring-white/10">
                <span className="mr-1 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Sinkronisasi…
              </span>
            )}
            <span className="ml-2 text-[11px] text-white/40">Terakhir: {lastSyncMs !== null ? lastSyncMs : '—'} ms</span>
            <span className="ml-2 text-[11px] text-white/55">Pukul: {lastSyncAt ?? '—'}</span>
          </h2>
          <button
            onClick={markAllRead}
            className="ml-3 text-sm px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
            title="Tandai semua sebagai dibaca"
          >
            Tandai Semua Dibaca
          </button>
        </div>

          <div className="border border-white/10 rounded-2xl overflow-hidden shadow-sm bg-white/5">
            {emails.length === 0 ? (
              loading ? (
                <div className="bg-transparent p-4 sm:p-6">
                  <div className="space-y-3">
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                    <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                  </div>
                </div>
              ) : (
                <div className="text-center py-14 text-white/70 bg-transparent">
                  <Mail size={48} className="mx-auto mb-4 text-white/30" />
                  <p className="font-medium">Kotak masuk Anda kosong</p>
                  <p className="text-sm mt-1">Email yang dikirim ke {currentAddress() || 'alamat ini'} akan tampil di sini</p>
                  <p className="text-[10px] mt-4 opacity-40 italic">Semua pesan otomatis dihapus setelah 1 jam</p>
                </div>
              )
            ) : (
              <div className="divide-y divide-white/10">
                {emails.map((m) => (
                  <div
                    key={m.id}
                    className={`p-4 hover:bg-white/10 cursor-pointer transition-colors ${
                      !m.read ? 'bg-fuchsia-600/10' : 'bg-transparent'
                    }`}
                    onClick={() => {
                      const detail: Email = {
                        id: m.id,
                        from: m.from,
                        subject: m.subject,
                        date: m.date,
                        body: m.body,
                        htmlBody: m.htmlBody,
                        read: true,
                      };
                      setSelectedEmail(detail);
                      setEmails(prev => prev.map(x => x.id === m.id ? { ...x, read: true } : x));
                      if (!m.read) {
                        setNewCount(c => (c > 0 ? c - 1 : 0));
                      }
                      try {
                        const addr = currentAddress();
                        const ids = loadReadIds(addr);
                        ids.add(m.id);
                        saveReadIds(ids, addr);
                        const keys = loadReadKeys(addr);
                        keys.add(messageKey(m));
                        saveReadKeys(keys, addr);
                      } catch {}
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">
                          {m.subject}
                        </h3>
                        <p className="text-sm text-white/60 truncate">
                          Dari: {m.from}
                        </p>
                        {!m.read && (
                          <span className="inline-block mt-1 text-[10px] font-semibold bg-fuchsia-600/20 text-fuchsia-100 px-1.5 py-0.5 rounded">
                            Baru
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/55 whitespace-nowrap">
                          {new Date(m.date).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteEmail(m.id);
                          }}
                          className="p-1 transition-colors text-white/40 hover:text-rose-200"
                          title="Hapus email"
                        >
                          <div className="relative">
                            <Trash2 size={16} />
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedEmail && (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-lg ring-1 ring-white/10 p-6 mb-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">{selectedEmail.subject}</h2>
                <p className="text-sm text-white/60">
                  Dari: {selectedEmail.from} • {new Date(selectedEmail.date).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-white/50 hover:text-white transition-colors"
                title="Tutup"
              >
                ✕
              </button>
            </div>
            <div className="prose prose-sm sm:prose prose-invert max-w-none">
              {selectedEmail.htmlBody ? (
                <div dangerouslySetInnerHTML={{ __html: selectedEmail.htmlBody }} />
              ) : (
                <p>{selectedEmail.body}</p>
              )}
            </div>
          </div>
        )}

        <section className="mt-12 mb-10 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.35)] overflow-hidden">
          <div className="px-6 py-6 sm:px-8 sm:py-7 border-b border-white/10 bg-linear-to-r from-fuchsia-500/10 via-pink-500/10 to-rose-500/10">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold bg-white/5 text-white/70 ring-1 ring-white/10 mb-2">
                  <Sparkles size={12} className="text-fuchsia-300" />
                  Panduan & Info
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Panduan Singkat
                </h2>
                <p className="text-sm sm:text-[15px] text-white/70 mt-2 max-w-3xl">
                  Email sementara untuk menerima pesan dengan cepat tanpa memakai email utama. Cocok untuk testing, trial aplikasi,
                  verifikasi newsletter, dan kebutuhan sementara lainnya.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="group rounded-2xl border border-white/10 bg-black/10 p-5 transition hover:bg-white/5 hover:border-white/15">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-2xl bg-fuchsia-500/10 ring-1 ring-fuchsia-500/20 flex items-center justify-center text-fuchsia-200">
                    <Inbox size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white">Cara Pakai</h3>
                    <p className="text-xs text-white/55">Langkah cepat dari buat alamat sampai baca pesan</p>
                  </div>
                </div>
                <ol className="text-sm text-white/70 space-y-2 list-decimal list-inside">
                  <li>Buat alamat email sementara di atas.</li>
                  <li>Salin alamat, lalu pakai untuk daftar/login di website lain.</li>
                  <li>Tunggu email masuk di bagian Kotak Masuk (auto refresh 10 detik).</li>
                  <li>Buka pesan untuk melihat isi/OTP, lalu selesai.</li>
                </ol>
              </div>

              <div className="group rounded-2xl border border-white/10 bg-black/10 p-5 transition hover:bg-white/5 hover:border-white/15">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center text-emerald-200">
                    <Shield size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white">FAQ</h3>
                    <p className="text-xs text-white/55">Jawaban cepat pertanyaan yang paling sering</p>
                  </div>
                </div>

                <div className="text-sm text-white/70 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="font-medium text-white/90">Kenapa email belum muncul?</div>
                    <div className="mt-1">Biasanya karena pengirim lambat, antrean Gmail, atau koneksi. Auto refresh jalan tiap 10 detik.</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="font-medium text-white/90">Berapa lama pesan disimpan?</div>
                    <div className="mt-1">Pesan akan dihapus otomatis setelah 1 jam untuk menjaga privasi dan mengurangi penumpukan.</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="font-medium text-white/90">Apakah aman untuk akun penting?</div>
                    <div className="mt-1">Tidak disarankan. Gunakan hanya untuk kebutuhan sementara, bukan akun utama/finansial.</div>
                  </div>
                </div>
              </div>

              <div className="group rounded-2xl border border-white/10 bg-black/10 p-5 transition hover:bg-white/5 hover:border-white/15">
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20 flex items-center justify-center text-amber-200">
                    <Zap size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white">Aturan Penggunaan</h3>
                    <p className="text-xs text-white/55">Menjaga layanan tetap aman untuk semua</p>
                  </div>
                </div>
                <ul className="text-sm text-white/70 space-y-2 list-disc list-inside">
                  <li>Dilarang untuk spam, penipuan, atau aktivitas ilegal.</li>
                  <li>Jangan gunakan untuk melewati keamanan/penyalahgunaan layanan pihak lain.</li>
                  <li>Gunakan seperlunya, karena pesan bersifat sementara.</li>
                </ul>
                <div className="mt-4 text-xs text-white/50">
                  Dengan memakai layanan ini, kamu setuju dengan <a href="/terms" className="text-fuchsia-200 hover:underline">Terms</a> dan
                  <a href="/privacy" className="ml-1 text-fuchsia-200 hover:underline">Privacy Policy</a>.
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="text-center text-sm text-white/60 mt-12">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>
              &copy; 2025{' '}
              <a
                href="https://qinzstore.asia"
                target="_blank"
                rel="noopener noreferrer"
                className="text-fuchsia-200 hover:underline"
              >
                QINZ STORE
              </a>
            </span>
            <span className="text-white/30">|</span>
            <a href="/privacy" className="text-fuchsia-200 hover:underline">
              Privacy Policy
            </a>
            <span className="text-white/30">|</span>
            <a href="/terms" className="text-fuchsia-200 hover:underline">
              Terms
            </a>
          </div>
        </footer>
      </div>
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-60 flex flex-col gap-2">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`pointer-events-auto px-3 py-2 rounded-lg shadow-md text-sm text-white ${
                t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-rose-600' : 'bg-gray-800'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
      {(accessChecking || (accessGateEnabled && !accessGranted)) && (
        <div className="fixed inset-0 z-70 flex items-center justify-center px-4 py-8 bg-[#0b0613]">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(900px 450px at 50% 0%, rgba(236,72,153,0.45), transparent 60%), radial-gradient(700px 420px at 85% 25%, rgba(168,85,247,0.40), transparent 55%)' }} aria-hidden="true" />
          <div className="relative w-full max-w-md rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-8 text-white">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-fuchsia-500/15 text-fuchsia-200 flex items-center justify-center">
              <Shield size={28} />
            </div>
            <div className="text-center mb-6">
              <p className="text-sm uppercase tracking-[0.2em] text-fuchsia-200">Halaman terkunci</p>
              <h2 className="text-2xl font-semibold mt-2">Masukkan kode akses</h2>
              <p className="text-sm text-white/60 mt-2">Hubungi admin untuk mendapatkan kode terbaru.</p>
            </div>
            {accessChecking ? (
              <div className="text-center text-sm text-white/60">Memeriksa akses tersimpan...</div>
            ) : (
              <form className="space-y-4" onSubmit={handleAccessSubmit}>
                <div>
                  <label className="block text-xs font-semibold text-white/70 tracking-[0.2em] mb-2">
                    KODE AKSES
                  </label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="cth: 1852"
                    disabled={accessSubmitting}
                    className="w-full h-12 rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60"
                  />
                </div>
                {accessError && <p className="text-sm text-red-400">{accessError}</p>}
                <button
                  type="submit"
                  disabled={accessSubmitting}
                  className={`w-full h-12 rounded-xl font-semibold transition-all shadow-lg ${
                    accessSubmitting
                      ? 'bg-fuchsia-500/40 text-white/80 cursor-not-allowed'
                      : 'bg-linear-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:from-fuchsia-500 hover:via-pink-500 hover:to-rose-500 text-white'
                  }`}
                >
                  {accessSubmitting ? 'Memeriksa...' : 'Masuk'}
                </button>
              </form>
            )}
            <p className="text-center text-xs text-white/40 mt-6">Halaman ini dilindungi. Akses hanya untuk pengguna terotorisasi.</p>
          </div>
        </div>
      )}
    </main>
  );
}
