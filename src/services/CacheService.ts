/**
 * Generic TTL cache service
 */
export class CacheService<T> {
  private cache = new Map<string, { data: T; expires: number }>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private ttlMs: number = 5 * 60 * 1000) {
    // Start cleanup interval (every minute)
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Get cached value if not expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached value with TTL
   */
  set(key: string, data: T, customTtlMs?: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + (customTtlMs ?? this.ttlMs),
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Update TTL for existing entry
   */
  touch(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    entry.expires = Date.now() + this.ttlMs;
    return true;
  }

  /**
   * Destroy the cache service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}
