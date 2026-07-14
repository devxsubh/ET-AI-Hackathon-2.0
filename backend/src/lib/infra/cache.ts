import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Shared async interface — implemented by both Redis and in-memory backends.
// ---------------------------------------------------------------------------

export interface AsyncCache<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Remove all live keys whose name starts with `prefix`. */
  invalidatePrefix(prefix: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory fallback — used when UPSTASH_REDIS_REST_URL is not set.
// ---------------------------------------------------------------------------

interface MemEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache<T> implements AsyncCache<T> {
  private store = new Map<string, MemEntry<T>>();
  private readonly maxSize: number;
  private timer: ReturnType<typeof setInterval>;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.timer = setInterval(() => this.evict(), 60_000);
    this.timer.unref();
  }

  async get(key: string): Promise<T | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) { this.store.delete(key); return null; }
    return e.value;
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    if (this.store.size >= this.maxSize) {
      const first = this.store.keys().next().value;
      if (first !== undefined) this.store.delete(first);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  private evict(): void {
    const now = Date.now();
    for (const [k, e] of this.store) if (now > e.expiresAt) this.store.delete(k);
  }
}

// ---------------------------------------------------------------------------
// Upstash Redis backend.
// ---------------------------------------------------------------------------

class RedisCache<T> implements AsyncCache<T> {
  constructor(private client: Redis) {}

  async get(key: string): Promise<T | null> {
    return this.client.get<T>(key);
  }

  async set(key: string, value: T, ttlMs: number): Promise<void> {
    const ex = Math.max(1, Math.ceil(ttlMs / 1000));
    await this.client.set(key, value, { ex });
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    let cursor = 0;
    do {
      const [next, keys] = await this.client.scan(cursor, {
        match: `${prefix}*`,
        count: 100,
      });
      cursor = Number(next);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== 0);
  }
}

// ---------------------------------------------------------------------------
// Factory — picks Redis when Upstash env vars are present, else memory.
// ---------------------------------------------------------------------------

let sharedRedis: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  if (!sharedRedis) sharedRedis = new Redis({ url, token });
  return sharedRedis;
}

function createCache<T>(maxMemorySize = 1_000): AsyncCache<T> {
  const redis = getRedis();
  if (redis) return new RedisCache<T>(redis);
  return new MemoryCache<T>(maxMemorySize);
}

export function isCacheRedis(): boolean {
  return getRedis() !== null;
}

// ---------------------------------------------------------------------------
// TTL constants (ms).
// ---------------------------------------------------------------------------

export const TTL = {
  startupList: 30_000,
  startupDetail: 30_000,
  userProfile: 2 * 60_000,
  chatList: 30_000,
} as const;

export const startupListCache = createCache<unknown[]>(500);
export const startupDetailCache = createCache<unknown>(2_000);
export const userProfileCache = createCache<unknown>(500);
export const chatListCache = createCache<unknown[]>(500);

export const cacheKey = {
  startupList: (userId: string) => `startups:list:${userId}`,
  startupDetail: (startupId: string, userId: string) =>
    `startups:detail:${startupId}:${userId}`,
  userProfile: (userId: string) => `user:profile:${userId}`,
  chatList: (userId: string) => `chats:list:${userId}`,
} as const;
