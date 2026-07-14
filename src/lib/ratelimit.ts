import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazily initialized so it doesn't blow up if env vars aren't set yet
let _ratelimit: Ratelimit | null = null;

export function getRatelimit(): Ratelimit {
  if (!_ratelimit) {
    _ratelimit = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      // 30 requests per minute per API token
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: false,
    });
  }
  return _ratelimit;
}
