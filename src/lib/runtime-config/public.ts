export type PublicRuntimeConfig = {
  ldapAuthUrl: string;
  clientId: string;
  redirectUri: string;
  appUrl: string;
  appEnv?: string;
};

const STORAGE_KEY = 'vz_runtime_config_v1';

let cachedPromise: Promise<PublicRuntimeConfig> | null = null;
let cachedValue: PublicRuntimeConfig | null = null;

function readFromSessionStorage(): PublicRuntimeConfig | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicRuntimeConfig;
  } catch {
    return null;
  }
}

function writeToSessionStorage(cfg: PublicRuntimeConfig) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore (quota / privacy mode)
  }
}

/**
 * Initialize (and cache) the public runtime config.
 * Call this once early (e.g. in root layout client bootstrap).
 */
export async function initPublicRuntimeConfig(): Promise<PublicRuntimeConfig> {
  const cfg = await getPublicRuntimeConfig();
  return cfg;
}

/**
 * Get the cached config synchronously (after init).
 * Falls back to `sessionStorage` if available.
 */
export function getPublicRuntimeConfigSync(): PublicRuntimeConfig {
  if (typeof window === 'undefined') {
    throw new Error('getPublicRuntimeConfigSync() can only be used in the browser');
  }
  if (cachedValue) return cachedValue;
  const fromStorage = readFromSessionStorage();
  if (fromStorage) {
    cachedValue = fromStorage;
    return fromStorage;
  }
  throw new Error('Public runtime config not initialized yet. Call initPublicRuntimeConfig() first.');
}

/**
 * Fetch safe runtime config from the server.
 * This is the ONLY supported way for client code to get runtime env-derived values.
 */
export function getPublicRuntimeConfig(): Promise<PublicRuntimeConfig> {
  if (typeof window === 'undefined') {
    // In server contexts, prefer `getServerRuntimeConfig()` instead.
    return Promise.reject(new Error('getPublicRuntimeConfig() can only be used in the browser'));
  }

  if (cachedValue) {
    return Promise.resolve(cachedValue);
  }

  const fromStorage = readFromSessionStorage();
  if (fromStorage) {
    cachedValue = fromStorage;
    return Promise.resolve(fromStorage);
  }

  if (!cachedPromise) {
    cachedPromise = fetch('/api/config', { method: 'GET', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`Failed to load runtime config: ${res.status} ${txt}`);
        }
        const cfg = (await res.json()) as PublicRuntimeConfig;
        cachedValue = cfg;
        writeToSessionStorage(cfg);
        return cfg;
      })
      .catch((err) => {
        // If it fails once, allow retries later.
        cachedPromise = null;
        throw err;
      });
  }

  return cachedPromise;
}

