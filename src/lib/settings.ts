import { promises as fs } from 'fs';
import path from 'path';

export type AppSettings = {
  accessGateEnabled: boolean;
  maintenanceMode: boolean;
  siteTitle: string;
  siteDescription: string;
  logoUrl: string;
  faviconUrl: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  accessGateEnabled: true,
  maintenanceMode: false,
  siteTitle: 'Email Sementara',
  siteDescription: 'Layanan email sementara sekali pakai',
  logoUrl: '',
  faviconUrl: '/icon.svg',
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
        siteTitle: typeof parsed?.siteTitle === 'string' ? parsed.siteTitle : DEFAULT_SETTINGS.siteTitle,
        siteDescription:
          typeof parsed?.siteDescription === 'string'
            ? parsed.siteDescription
            : DEFAULT_SETTINGS.siteDescription,
        logoUrl: typeof parsed?.logoUrl === 'string' ? parsed.logoUrl : DEFAULT_SETTINGS.logoUrl,
        faviconUrl: typeof parsed?.faviconUrl === 'string' ? parsed.faviconUrl : DEFAULT_SETTINGS.faviconUrl,
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
      siteTitle: typeof parsed?.siteTitle === 'string' ? parsed.siteTitle : DEFAULT_SETTINGS.siteTitle,
      siteDescription:
        typeof parsed?.siteDescription === 'string'
          ? parsed.siteDescription
          : DEFAULT_SETTINGS.siteDescription,
      logoUrl: typeof parsed?.logoUrl === 'string' ? parsed.logoUrl : DEFAULT_SETTINGS.logoUrl,
      faviconUrl: typeof parsed?.faviconUrl === 'string' ? parsed.faviconUrl : DEFAULT_SETTINGS.faviconUrl,
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
    siteTitle: typeof patch.siteTitle === 'string' ? patch.siteTitle : current.siteTitle,
    siteDescription:
      typeof patch.siteDescription === 'string' ? patch.siteDescription : current.siteDescription,
    logoUrl: typeof patch.logoUrl === 'string' ? patch.logoUrl : current.logoUrl,
    faviconUrl: typeof patch.faviconUrl === 'string' ? patch.faviconUrl : current.faviconUrl,
  };
  if (hasKv()) {
    await kvSet(KV_KEY, JSON.stringify(next));
    return next;
  }
  await fs.writeFile(storePath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
