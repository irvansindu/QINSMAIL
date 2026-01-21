import { promises as fs } from 'fs';
import path from 'path';

export type AppSettings = {
  accessGateEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceTitle: string;
  maintenanceMessage: string;
  maintenanceEtaText: string;
  maintenanceContactText: string;
  maintenanceContactUrl: string;
  privacyPolicyText: string;
  termsText: string;
  siteTitle: string;
  siteDescription: string;
  logoUrl: string;
  faviconUrl: string;
  promoBannerEnabled: boolean;
  promoBannerText: string;
  promoBannerUrl: string;
  promoBannerVariant: 'info' | 'success' | 'warning';
};

const DEFAULT_SETTINGS: AppSettings = {
  accessGateEnabled: true,
  maintenanceMode: false,
  maintenanceTitle: 'Sistem Sedang Diperbarui',
  maintenanceMessage:
    'Kami sedang melakukan pemeliharaan rutin untuk meningkatkan layanan. Kami akan segera kembali!',
  maintenanceEtaText: 'Segera Kembali',
  maintenanceContactText: '',
  maintenanceContactUrl: '',
  privacyPolicyText: '',
  termsText: '',
  siteTitle: 'Email Sementara',
  siteDescription: 'Layanan email sementara sekali pakai',
  logoUrl: '',
  faviconUrl: '/icon.svg',
  promoBannerEnabled: false,
  promoBannerText: '',
  promoBannerUrl: '',
  promoBannerVariant: 'info',
};

const KV_KEY = 'qinsmail:settings';

function kvUrl(): string {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
}

function kvToken(): string {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
}

function hasKv(): boolean {
  return Boolean(kvUrl() && kvToken());
}

async function kvGet(key: string): Promise<string | null> {
  const url = kvUrl();
  const token = kvToken();
  if (!url || !token) return null;
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as { result?: string | null } | null;
  return typeof json?.result === 'string' ? json.result : null;
}

async function kvSet(key: string, value: string): Promise<void> {
  const url = kvUrl();
  const token = kvToken();
  if (!url || !token) return;
  const encoded = encodeURIComponent(value);
  await fetch(`${url}/set/${encodeURIComponent(key)}/${encoded}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

const storePath = path.join(process.cwd(), 'data', 'settings.json');

async function ensureStoreFile(): Promise<void> {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
  }
}

export async function getSettings(): Promise<AppSettings> {
  if (hasKv()) {
    const raw = await kvGet(KV_KEY);
    if (!raw) {
      await kvSet(KV_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return { ...DEFAULT_SETTINGS };
    }
    try {
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      return {
        accessGateEnabled:
          typeof parsed?.accessGateEnabled === 'boolean'
            ? parsed.accessGateEnabled
            : DEFAULT_SETTINGS.accessGateEnabled,
        maintenanceMode:
          typeof parsed?.maintenanceMode === 'boolean'
            ? parsed.maintenanceMode
            : DEFAULT_SETTINGS.maintenanceMode,
        maintenanceTitle:
          typeof parsed?.maintenanceTitle === 'string'
            ? parsed.maintenanceTitle
            : DEFAULT_SETTINGS.maintenanceTitle,
        maintenanceMessage:
          typeof parsed?.maintenanceMessage === 'string'
            ? parsed.maintenanceMessage
            : DEFAULT_SETTINGS.maintenanceMessage,
        maintenanceEtaText:
          typeof parsed?.maintenanceEtaText === 'string'
            ? parsed.maintenanceEtaText
            : DEFAULT_SETTINGS.maintenanceEtaText,
        maintenanceContactText:
          typeof parsed?.maintenanceContactText === 'string'
            ? parsed.maintenanceContactText
            : DEFAULT_SETTINGS.maintenanceContactText,
        maintenanceContactUrl:
          typeof parsed?.maintenanceContactUrl === 'string'
            ? parsed.maintenanceContactUrl
            : DEFAULT_SETTINGS.maintenanceContactUrl,
        privacyPolicyText:
          typeof parsed?.privacyPolicyText === 'string'
            ? parsed.privacyPolicyText
            : DEFAULT_SETTINGS.privacyPolicyText,
        termsText:
          typeof parsed?.termsText === 'string' ? parsed.termsText : DEFAULT_SETTINGS.termsText,
        siteTitle: typeof parsed?.siteTitle === 'string' ? parsed.siteTitle : DEFAULT_SETTINGS.siteTitle,
        siteDescription:
          typeof parsed?.siteDescription === 'string'
            ? parsed.siteDescription
            : DEFAULT_SETTINGS.siteDescription,
        logoUrl: typeof parsed?.logoUrl === 'string' ? parsed.logoUrl : DEFAULT_SETTINGS.logoUrl,
        faviconUrl: typeof parsed?.faviconUrl === 'string' ? parsed.faviconUrl : DEFAULT_SETTINGS.faviconUrl,
        promoBannerEnabled:
          typeof parsed?.promoBannerEnabled === 'boolean'
            ? parsed.promoBannerEnabled
            : DEFAULT_SETTINGS.promoBannerEnabled,
        promoBannerText:
          typeof parsed?.promoBannerText === 'string'
            ? parsed.promoBannerText
            : DEFAULT_SETTINGS.promoBannerText,
        promoBannerUrl:
          typeof parsed?.promoBannerUrl === 'string'
            ? parsed.promoBannerUrl
            : DEFAULT_SETTINGS.promoBannerUrl,
        promoBannerVariant:
          parsed?.promoBannerVariant === 'info' ||
          parsed?.promoBannerVariant === 'success' ||
          parsed?.promoBannerVariant === 'warning'
            ? parsed.promoBannerVariant
            : DEFAULT_SETTINGS.promoBannerVariant,
      };
    } catch {
      await kvSet(KV_KEY, JSON.stringify(DEFAULT_SETTINGS));
      return { ...DEFAULT_SETTINGS };
    }
  }

  await ensureStoreFile();
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      accessGateEnabled:
        typeof parsed?.accessGateEnabled === 'boolean'
          ? parsed.accessGateEnabled
          : DEFAULT_SETTINGS.accessGateEnabled,
      maintenanceMode:
        typeof parsed?.maintenanceMode === 'boolean'
          ? parsed.maintenanceMode
          : DEFAULT_SETTINGS.maintenanceMode,
      maintenanceTitle:
        typeof parsed?.maintenanceTitle === 'string'
          ? parsed.maintenanceTitle
          : DEFAULT_SETTINGS.maintenanceTitle,
      maintenanceMessage:
        typeof parsed?.maintenanceMessage === 'string'
          ? parsed.maintenanceMessage
          : DEFAULT_SETTINGS.maintenanceMessage,
      maintenanceEtaText:
        typeof parsed?.maintenanceEtaText === 'string'
          ? parsed.maintenanceEtaText
          : DEFAULT_SETTINGS.maintenanceEtaText,
      maintenanceContactText:
        typeof parsed?.maintenanceContactText === 'string'
          ? parsed.maintenanceContactText
          : DEFAULT_SETTINGS.maintenanceContactText,
      maintenanceContactUrl:
        typeof parsed?.maintenanceContactUrl === 'string'
          ? parsed.maintenanceContactUrl
          : DEFAULT_SETTINGS.maintenanceContactUrl,
      privacyPolicyText:
        typeof parsed?.privacyPolicyText === 'string'
          ? parsed.privacyPolicyText
          : DEFAULT_SETTINGS.privacyPolicyText,
      termsText:
        typeof parsed?.termsText === 'string' ? parsed.termsText : DEFAULT_SETTINGS.termsText,
      siteTitle: typeof parsed?.siteTitle === 'string' ? parsed.siteTitle : DEFAULT_SETTINGS.siteTitle,
      siteDescription:
        typeof parsed?.siteDescription === 'string'
          ? parsed.siteDescription
          : DEFAULT_SETTINGS.siteDescription,
      logoUrl: typeof parsed?.logoUrl === 'string' ? parsed.logoUrl : DEFAULT_SETTINGS.logoUrl,
      faviconUrl: typeof parsed?.faviconUrl === 'string' ? parsed.faviconUrl : DEFAULT_SETTINGS.faviconUrl,
      promoBannerEnabled:
        typeof parsed?.promoBannerEnabled === 'boolean'
          ? parsed.promoBannerEnabled
          : DEFAULT_SETTINGS.promoBannerEnabled,
      promoBannerText:
        typeof parsed?.promoBannerText === 'string'
          ? parsed.promoBannerText
          : DEFAULT_SETTINGS.promoBannerText,
      promoBannerUrl:
        typeof parsed?.promoBannerUrl === 'string'
          ? parsed.promoBannerUrl
          : DEFAULT_SETTINGS.promoBannerUrl,
      promoBannerVariant:
        parsed?.promoBannerVariant === 'info' ||
        parsed?.promoBannerVariant === 'success' ||
        parsed?.promoBannerVariant === 'warning'
          ? parsed.promoBannerVariant
          : DEFAULT_SETTINGS.promoBannerVariant,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = {
    accessGateEnabled:
      typeof patch.accessGateEnabled === 'boolean'
        ? patch.accessGateEnabled
        : current.accessGateEnabled,
    maintenanceMode:
      typeof patch.maintenanceMode === 'boolean'
        ? patch.maintenanceMode
        : current.maintenanceMode,
    maintenanceTitle:
      typeof patch.maintenanceTitle === 'string' ? patch.maintenanceTitle : current.maintenanceTitle,
    maintenanceMessage:
      typeof patch.maintenanceMessage === 'string'
        ? patch.maintenanceMessage
        : current.maintenanceMessage,
    maintenanceEtaText:
      typeof patch.maintenanceEtaText === 'string'
        ? patch.maintenanceEtaText
        : current.maintenanceEtaText,
    maintenanceContactText:
      typeof patch.maintenanceContactText === 'string'
        ? patch.maintenanceContactText
        : current.maintenanceContactText,
    maintenanceContactUrl:
      typeof patch.maintenanceContactUrl === 'string'
        ? patch.maintenanceContactUrl
        : current.maintenanceContactUrl,
    privacyPolicyText:
      typeof patch.privacyPolicyText === 'string' ? patch.privacyPolicyText : current.privacyPolicyText,
    termsText: typeof patch.termsText === 'string' ? patch.termsText : current.termsText,
    siteTitle: typeof patch.siteTitle === 'string' ? patch.siteTitle : current.siteTitle,
    siteDescription:
      typeof patch.siteDescription === 'string' ? patch.siteDescription : current.siteDescription,
    logoUrl: typeof patch.logoUrl === 'string' ? patch.logoUrl : current.logoUrl,
    faviconUrl: typeof patch.faviconUrl === 'string' ? patch.faviconUrl : current.faviconUrl,
    promoBannerEnabled:
      typeof patch.promoBannerEnabled === 'boolean'
        ? patch.promoBannerEnabled
        : current.promoBannerEnabled,
    promoBannerText:
      typeof patch.promoBannerText === 'string' ? patch.promoBannerText : current.promoBannerText,
    promoBannerUrl:
      typeof patch.promoBannerUrl === 'string' ? patch.promoBannerUrl : current.promoBannerUrl,
    promoBannerVariant:
      patch.promoBannerVariant === 'info' ||
      patch.promoBannerVariant === 'success' ||
      patch.promoBannerVariant === 'warning'
        ? patch.promoBannerVariant
        : current.promoBannerVariant,
  };
  if (hasKv()) {
    await kvSet(KV_KEY, JSON.stringify(next));
    return next;
  }
  await fs.writeFile(storePath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
