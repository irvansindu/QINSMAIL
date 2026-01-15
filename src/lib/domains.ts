import { promises as fs } from 'fs';
import path from 'path';

const DEFAULT_DOMAINS = [
  'digitexa.biz.id',
  'irvansindu.online',
  'irvanmail.store',
  'irvanstore.web.id',
  'zemio.biz.id',
  'zitemo.biz.id',
  'irvantra.web.id',
  'fivanstore.my.id',
  'itemku.biz.id',
  'fivanstore.shop',
  'docverter.web.id',
  'premiuminaja.biz.id',
  'capcutinaja.biz.id',
  'capcuters.web.id',
];

const storePath = path.join(process.cwd(), 'data', 'domains.json');

async function ensureStoreFile(): Promise<void> {
  try {
    await fs.access(storePath);
  } catch {
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    await fs.writeFile(storePath, JSON.stringify(DEFAULT_DOMAINS, null, 2), 'utf8');
  }
}

function normalizeDomain(input: string): string {
  return (input || '').trim().toLowerCase();
}

function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  if (domain.length > 253) return false;
  if (domain.includes('://')) return false;
  if (domain.includes('/')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  if (domain.includes('..')) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (!label || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    if (!/^[a-z0-9-]+$/.test(label)) return false;
  }
  return true;
}

export async function getDomains(): Promise<string[]> {
  await ensureStoreFile();
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed) ? parsed : [];
    const out = list
      .map(v => (typeof v === 'string' ? normalizeDomain(v) : ''))
      .filter(Boolean)
      .filter(isValidDomain);
    return Array.from(new Set(out)).sort();
  } catch {
    return [...DEFAULT_DOMAINS].sort();
  }
}

async function saveDomains(domains: string[]): Promise<void> {
  await ensureStoreFile();
  await fs.writeFile(storePath, JSON.stringify(domains, null, 2), 'utf8');
}

export async function addDomain(domainRaw: string): Promise<string[]> {
  const domain = normalizeDomain(domainRaw);
  if (!isValidDomain(domain)) throw new Error('invalid-domain');
  const list = await getDomains();
  if (list.includes(domain)) return list;
  const next = [...list, domain].sort();
  await saveDomains(next);
  return next;
}

export async function deleteDomain(domainRaw: string): Promise<string[]> {
  const domain = normalizeDomain(domainRaw);
  const list = await getDomains();
  const next = list.filter(d => d !== domain);
  await saveDomains(next);
  return next;
}
