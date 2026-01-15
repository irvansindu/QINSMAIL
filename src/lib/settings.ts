import { promises as fs } from 'fs';
import path from 'path';

export type AppSettings = {
  accessGateEnabled: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  accessGateEnabled: true,
};

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
  await ensureStoreFile();
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      accessGateEnabled:
        typeof parsed?.accessGateEnabled === 'boolean'
          ? parsed.accessGateEnabled
          : DEFAULT_SETTINGS.accessGateEnabled,
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
  };
  await fs.writeFile(storePath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
