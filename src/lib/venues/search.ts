import { searchPhoton, type VenueSuggestion } from './photon';

export type { VenueSuggestion };

const NOMINATIM_USER_AGENT = 'DanielCimoViolin/1.0 (admin venue search; https://danielcimo.com)';
/** Central Coast of California. bounded=0 prefers this box without hiding places outside it. */
const CENTRAL_COAST_VIEWBOX = '-121.5,35.8,-119.5,34.4';

type NominatimAddress = {
  house_number?: unknown;
  road?: unknown;
  city?: unknown;
  town?: unknown;
  village?: unknown;
  hamlet?: unknown;
  municipality?: unknown;
  city_district?: unknown;
  suburb?: unknown;
  county?: unknown;
  state?: unknown;
  postcode?: unknown;
};

const resultCache = new Map<string, { expires: number; results: VenueSuggestion[] }>();
const EMPTY_CACHE_MS = 15_000;
const HIT_CACHE_MS = 60_000;

let nominatimQueue: Promise<unknown> = Promise.resolve();
let lastNominatimAt = 0;

function text(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function formatNominatimPlace(place: { name?: unknown; address?: NominatimAddress } | null | undefined): VenueSuggestion | null {
  if (!place) return null;
  const address = place.address ?? {};
  const street = [text(address.house_number), text(address.road)].filter(Boolean).join(' ');
  const city =
    text(address.city) ||
    text(address.town) ||
    text(address.village) ||
    text(address.hamlet) ||
    text(address.municipality) ||
    text(address.city_district) ||
    text(address.suburb) ||
    text(address.county);
  const state = text(address.state);
  const postcode = text(address.postcode);
  const locality = [city, state].filter(Boolean).join(', ');
  const region = [locality, postcode].filter(Boolean).join(' ');
  const formatted = [street, region].filter(Boolean).join(', ');
  const name = text(place.name) || street || city;
  if (!name) return null;
  return { name, address: formatted };
}

export function parseNominatimResponse(body: unknown): VenueSuggestion[] {
  if (!Array.isArray(body)) return [];
  const results: VenueSuggestion[] = [];
  for (const item of body) {
    const suggestion = formatNominatimPlace(item as { name?: unknown; address?: NominatimAddress });
    if (!suggestion) continue;
    if (results.some((existing) => existing.name === suggestion.name && existing.address === suggestion.address)) continue;
    results.push(suggestion);
    if (results.length === 5) break;
  }
  return results;
}

/** Nominatim allows about one request per second. Calls share one queue. */
export function scheduleNominatim<T>(task: () => Promise<T>): Promise<T> {
  const run = nominatimQueue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastNominatimAt));
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastNominatimAt = Date.now();
    return task();
  });
  nominatimQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function searchNominatim(query: string, fetchImpl: typeof fetch = fetch): Promise<VenueSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3 || trimmed.length > 80) return [];
  return scheduleNominatim(async () => {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', trimmed);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    url.searchParams.set('countrycodes', 'us');
    url.searchParams.set('viewbox', CENTRAL_COAST_VIEWBOX);
    url.searchParams.set('bounded', '0');
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json', 'User-Agent': NOMINATIM_USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
    return parseNominatimResponse(await response.json());
  });
}

/**
 * Photon first. A timeout, block, or empty reply from Vercel falls through to
 * Nominatim, which is limited to about one request per second.
 */
export async function searchVenues(query: string, fetchImpl: typeof fetch = fetch): Promise<VenueSuggestion[]> {
  const key = query.trim().toLowerCase();
  if (key.length < 3 || key.length > 80) return [];
  const cached = resultCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.results;

  let results: VenueSuggestion[] = [];
  try {
    results = await searchPhoton(query, fetchImpl);
  } catch {
    results = [];
  }
  if (results.length === 0) {
    try {
      results = await searchNominatim(query, fetchImpl);
    } catch {
      results = [];
    }
  }
  resultCache.set(key, { expires: Date.now() + (results.length > 0 ? HIT_CACHE_MS : EMPTY_CACHE_MS), results });
  return results;
}
