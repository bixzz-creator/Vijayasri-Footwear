import { encrypt, decrypt } from './crypto';

interface ConfigCredentials {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** OCR.space API key — https://ocr.space/OCRAPI */
  ocrApiKey?: string;
  /** @deprecated migrated to ocrApiKey */
  geminiApiKey?: string;
  bytezApiKey?: string;
  openRouterApiKey?: string;
  aiProvider?: 'ocrspace' | 'gemini' | 'bytez' | 'openrouter';
  bytezModelId?: string;
  openRouterModelId?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('vijayasri_config_vault', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('credentials')) {
        db.createObjectStore('credentials');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  const transaction = db.transaction('credentials', mode);
  return transaction.objectStore('credentials');
}

export async function hasCredentials(): Promise<boolean> {
  const db = await openDB();
  return new Promise((resolve) => {
    const store = getStore(db, 'readonly');
    const request = store.get('encrypted_data');
    request.onsuccess = () => {
      resolve(!!request.result);
    };
    request.onerror = () => {
      resolve(false);
    };
  });
}

export function cleanHeaderValue(val?: string | null): string {
  if (!val) return '';
  return val
    .replace(/^["']|["']$/g, '')
    .replace(/[\r\n\t]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

export function cleanUrlValue(val?: string | null): string {
  if (!val) return '';
  return val
    .replace(/^["']|["']$/g, '')
    .replace(/[\r\n\t\s]/g, '')
    .trim();
}

export async function saveCredentials(
  config: ConfigCredentials,
  passcode: string
): Promise<void> {
  const db = await openDB();
  const sanitized: ConfigCredentials = {
    ...config,
    supabaseUrl: cleanUrlValue(config.supabaseUrl),
    supabaseAnonKey: cleanHeaderValue(config.supabaseAnonKey),
    ocrApiKey: cleanHeaderValue(config.ocrApiKey),
    bytezApiKey: cleanHeaderValue(config.bytezApiKey),
    openRouterApiKey: cleanHeaderValue(config.openRouterApiKey),
  };
  const serialized = JSON.stringify(sanitized);
  const encrypted = await encrypt(serialized, passcode);
  
  return new Promise((resolve, reject) => {
    const store = getStore(db, 'readwrite');
    const request = store.put(encrypted, 'encrypted_data');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadCredentials(passcode: string): Promise<ConfigCredentials | null> {
  const db = await openDB();
  const encrypted = await new Promise<string | null>((resolve, reject) => {
    const store = getStore(db, 'readonly');
    const request = store.get('encrypted_data');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  
  if (!encrypted) return null;
  
  const decrypted = await decrypt(encrypted, passcode);
  const parsed = JSON.parse(decrypted);
  if (!parsed) return null;

  return {
    ...parsed,
    supabaseUrl: cleanUrlValue(parsed.supabaseUrl),
    supabaseAnonKey: cleanHeaderValue(parsed.supabaseAnonKey),
    ocrApiKey: cleanHeaderValue(parsed.ocrApiKey),
    bytezApiKey: cleanHeaderValue(parsed.bytezApiKey),
    openRouterApiKey: cleanHeaderValue(parsed.openRouterApiKey),
  };
}

export async function clearCredentials(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = getStore(db, 'readwrite');
    const request = store.delete('encrypted_data');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
