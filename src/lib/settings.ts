import { promises as fs } from 'fs';
import path from 'path';

export type AppSettings = {
  accessGateEnabled: boolean;
  maintenanceMode: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  accessGateEnabled: true,
  maintenanceMode: false,
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
  };
  if (hasKv()) {
    await kvSet(KV_KEY, JSON.stringify(next));
    return next;
  }
  await fs.writeFile(storePath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
