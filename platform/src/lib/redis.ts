import { Redis } from '@upstash/redis'

/**
 * Singleton Redis client for high-frequency test state management.
 * We use Upstash Redis for serverless-friendly HTTP-based connections.
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
