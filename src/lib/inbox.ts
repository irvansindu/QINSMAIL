import crypto from 'crypto';

export interface StoredEmail {
  id: number;
  to: string; // full address
  from: string;
  subject: string;
  date: string;
  text?: string;
  html?: string;
}

// Try to use SQLite (better-sqlite3). If unavailable, fallback to in-memory.
type RunResult = { lastInsertRowid: number };
type Statement = {
  run: (...args: unknown[]) => RunResult;
  all: (...args: unknown[]) => unknown[];
  get: (...args: unknown[]) => unknown;
};
type BetterSqlite = {
  pragma: (sql: string) => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => Statement;
};
type BetterSqliteCtor = new (file: string) => BetterSqlite;

let db: BetterSqlite | null = null;
let inMemory = false;
let initPromise: Promise<void> | null = null;

async function ensureInit(): Promise<void> {
  if (db || inMemory) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const mod: unknown = await import('better-sqlite3');
      const Database: BetterSqliteCtor = (mod as { default?: BetterSqliteCtor }).default ?? (mod as unknown as BetterSqliteCtor);
      const file = process.env.DATABASE_PATH || 'db.sqlite';
      db = new Database(file);
      db.pragma('journal_mode = WAL');
      db.exec(
        `CREATE TABLE IF NOT EXISTS emails (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          to_addr TEXT NOT NULL,
          from_addr TEXT,
          subject TEXT,
          date TEXT,
          text_body TEXT,
          html_body TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_emails_to ON emails(to_addr);
        CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);
        `
      );
    } catch {
      inMemory = true;
    }
  })();
  return initPromise;
}

// In-memory store (resets on server restart)
const store = new Map<string, StoredEmail[]>(); // key: to address
let seq = 1;

function thresholdIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function pruneMemory(to?: string, hours: number = 24) {
  const cutoff = thresholdIso(hours);
  if (to) {
    const arr = store.get(to) || [];
    const filtered = arr.filter(m => (m.date || '') >= cutoff);
    store.set(to, filtered);
    return;
  }
  for (const [k, arr] of store.entries()) {
    store.set(k, arr.filter(m => (m.date || '') >= cutoff));
  }
}

function pruneSqlite(to?: string, hours: number = 24) {
  if (!db) return;
  const cutoff = thresholdIso(hours);
  if (to) {
    const del = db.prepare('DELETE FROM emails WHERE to_addr = ? AND date < ?');
    del.run(to, cutoff);
  } else {
    const del = db.prepare('DELETE FROM emails WHERE date < ?');
    del.run(cutoff);
  }
}

function getKey(): Buffer | null {
  const k = process.env.ENCRYPTION_KEY || '';
  try {
    if (!k) return null;
    const raw = Buffer.from(k, 'base64');
    if (raw.length !== 32) return null;
    return raw;
  } catch { return null; }
}

function encValue(plain: string | undefined): string | undefined {
  if (!plain) return undefined;
  const key = getKey();
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:gcm:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

function decValue(stored: string | undefined): string | undefined {
  if (!stored) return undefined;
  if (!stored.startsWith('enc:gcm:')) return stored;
  const key = getKey();
  if (!key) return undefined;
  const parts = stored.split(':');
  if (parts.length !== 5) return undefined;
  const iv = Buffer.from(parts[2], 'base64');
  const tag = Buffer.from(parts[3], 'base64');
  const ct = Buffer.from(parts[4], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

export async function addEmail(msg: Omit<StoredEmail, 'id'>): Promise<StoredEmail> {
  await ensureInit();
  const toSave = {
    ...msg,
    text: encValue(msg.text),
    html: encValue(msg.html),
  };
  if (db) {
    const ins = db.prepare(
      'INSERT INTO emails (to_addr, from_addr, subject, date, text_body, html_body) VALUES (?,?,?,?,?,?)'
    );
    const info = ins.run(toSave.to, toSave.from, toSave.subject, toSave.date, toSave.text || null, toSave.html || null);
    const id = Number(info.lastInsertRowid);
    return { id, ...msg };
  }
  // fallback in-memory
  const id = seq++;
  const rec: StoredEmail = { id, ...toSave } as StoredEmail;
  const arr = store.get(msg.to) || [];
  arr.unshift(rec);
  store.set(msg.to, arr);
  return { id, ...msg };
}

export async function listEmails(to: string, retentionHours: number = 24): Promise<StoredEmail[]> {
  await ensureInit();
  if (db) {
    pruneSqlite(to, retentionHours);
    const sel = db.prepare(
      'SELECT id, to_addr as "to", from_addr as "from", subject, date, text_body as text, html_body as html FROM emails WHERE to_addr = ? ORDER BY id DESC'
    );
    const rows = sel.all(to) as StoredEmail[];
    return rows.map(r => ({ ...r, text: decValue(r.text), html: decValue(r.html) }));
  }
  pruneMemory(to, retentionHours);
  const rows = store.get(to) || [];
  return rows.map(r => ({ ...r, text: decValue(r.text), html: decValue(r.html) }));
}

export async function getEmail(to: string, id: number): Promise<StoredEmail | undefined> {
  await ensureInit();
  if (db) {
    const sel = db.prepare(
      'SELECT id, to_addr as "to", from_addr as "from", subject, date, text_body as text, html_body as html FROM emails WHERE to_addr = ? AND id = ?'
    );
    const r = sel.get(to, id) as StoredEmail | undefined;
    return r ? { ...r, text: decValue(r.text), html: decValue(r.html) } : undefined;
  }
  const r = (store.get(to) || []).find(m => m.id === id);
  return r ? { ...r, text: decValue(r.text), html: decValue(r.html) } : undefined;
}
