export type RateBucket = { count: number; resetAt: number };

/** True when this IP may search. A full window starts again after it expires. */
export function allowVenueQuery(
  buckets: Map<string, RateBucket>,
  ip: string,
  now: number,
  limit = 20,
  windowMs = 60_000,
): boolean {
  const key = ip.trim() || 'unknown';
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const real = request.headers.get('x-real-ip')?.trim() ?? '';
  const ip = forwarded || real || 'unknown';
  return ip.slice(0, 80);
}
