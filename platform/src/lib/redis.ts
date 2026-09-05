import { Redis as UpstashRedis } from '@upstash/redis'

// Global in-memory storage fallback for local dev / serverless instances without Upstash or on network failures
const globalStore: Map<string, any> = (globalThis as any).__scorepigo_redis_store || new Map<string, any>()
const globalLists: Map<string, string[]> = (globalThis as any).__scorepigo_redis_lists || new Map<string, string[]>()
const globalHashes: Map<string, Record<string, any>> = (globalThis as any).__scorepigo_redis_hashes || new Map<string, Record<string, any>>()

if (process.env.NODE_ENV !== 'production') {
  ;(globalThis as any).__scorepigo_redis_store = globalStore
  ;(globalThis as any).__scorepigo_redis_lists = globalLists
  ;(globalThis as any).__scorepigo_redis_hashes = globalHashes
}

let upstashClient: UpstashRedis | null = null
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN

if (upstashUrl && upstashToken && upstashUrl.startsWith('http')) {
  try {
    upstashClient = new UpstashRedis({
      url: upstashUrl,
      token: upstashToken,
    })
  } catch (err) {
    console.warn('Failed to initialize Upstash Redis client:', err)
  }
}

class ResilientRedis {
  async get<T = any>(key: string): Promise<T | null> {
    if (upstashClient) {
      try {
        const val = await upstashClient.get<T>(key)
        if (val !== null && val !== undefined) {
          globalStore.set(key, val)
          return val
        }
      } catch (err) {
        console.warn(`Upstash get failed for key "${key}", falling back to memory:`, err)
      }
    }
    const val = globalStore.get(key)
    return val !== undefined ? (val as T) : null
  }

  async set(key: string, value: any, options?: any): Promise<any> {
    globalStore.set(key, value)
    if (upstashClient) {
      try {
        return await upstashClient.set(key, value, options as any)
      } catch (err) {
        console.warn(`Upstash set failed for key "${key}":`, err)
      }
    }
    return 'OK'
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0
    for (const k of keys) {
      if (globalStore.delete(k)) count++
      if (globalLists.delete(k)) count++
      if (globalHashes.delete(k)) count++
    }
    if (upstashClient) {
      try {
        return await upstashClient.del(...keys)
      } catch (err) {
        console.warn(`Upstash del failed:`, err)
      }
    }
    return count
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (upstashClient) {
      try {
        const res = await upstashClient.lrange(key, start, stop)
        if (Array.isArray(res)) {
          if (res.length > 0) {
            globalLists.set(key, res)
          }
          return res
        }
      } catch (err) {
        console.warn(`Upstash lrange failed for "${key}", falling back to memory:`, err)
      }
    }
    const list = globalLists.get(key) || []
    if (stop === -1 || stop >= list.length) {
      return list.slice(start)
    }
    return list.slice(start, stop + 1)
  }

  async lpush(key: string, ...elements: string[]): Promise<number> {
    const list = globalLists.get(key) || []
    list.unshift(...elements)
    globalLists.set(key, list)
    if (upstashClient) {
      try {
        return await upstashClient.lpush(key, ...elements)
      } catch (err) {
        console.warn(`Upstash lpush failed for "${key}":`, err)
      }
    }
    return list.length
  }

  async lrem(key: string, count: number, element: string): Promise<number> {
    const list = globalLists.get(key) || []
    let removed = 0
    const filtered = list.filter((item) => {
      if (item === element && (count === 0 || removed < Math.abs(count))) {
        removed++
        return false
      }
      return true
    })
    globalLists.set(key, filtered)
    if (upstashClient) {
      try {
        return await upstashClient.lrem(key, count, element)
      } catch (err) {
        console.warn(`Upstash lrem failed for "${key}":`, err)
      }
    }
    return removed
  }

  async hset(key: string, obj: Record<string, any>): Promise<number> {
    const existing = globalHashes.get(key) || {}
    globalHashes.set(key, { ...existing, ...obj })
    if (upstashClient) {
      try {
        return await upstashClient.hset(key, obj)
      } catch (err) {
        console.warn(`Upstash hset failed for "${key}":`, err)
      }
    }
    return Object.keys(obj).length
  }

  async hgetall(key: string): Promise<Record<string, any> | null> {
    if (upstashClient) {
      try {
        const res = await upstashClient.hgetall(key)
        if (res !== null && res !== undefined) return res as Record<string, any>
      } catch (err) {
        console.warn(`Upstash hgetall failed for "${key}", falling back to memory:`, err)
      }
    }
    return globalHashes.get(key) || null
  }

  async ping(): Promise<string> {
    if (upstashClient) {
      try {
        return await upstashClient.ping()
      } catch {
        // ignore
      }
    }
    return 'PONG'
  }
}

export const redis = new ResilientRedis()

