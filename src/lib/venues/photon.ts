/** San Luis Obispo. Photon uses this as a focus point, not a hard boundary. */
export const CENTRAL_COAST_FOCUS = { lat: '35.2828', lon: '-120.6596' };

export const PHOTON_USER_AGENT = 'DanielCimoViolin/1.0 (admin venue search; https://danielcimo.com)';

export type VenueSuggestion = {
  name: string;
  address: string;
};

type PhotonProperties = {
  name?: unknown;
  street?: unknown;
  housenumber?: unknown;
  city?: unknown;
  locality?: unknown;
  district?: unknown;
  county?: unknown;
  state?: unknown;
  postcode?: unknown;
  country?: unknown;
};

const cache = new Map<string, { expires: number; results: VenueSuggestion[] }>();
const CACHE_MS = 60_000;

function text(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/** Street, city, state, ZIP from one Photon feature. */
export function formatPhotonFeature(properties: PhotonProperties | null | undefined): VenueSuggestion | null {
  if (!properties) return null;
  const name = text(properties.name);
  const street = [text(properties.housenumber), text(properties.street)].filter(Boolean).join(' ');
  const city = text(properties.city) || text(properties.locality) || text(properties.district) || text(properties.county);
  const state = text(properties.state);
  const postcode = text(properties.postcode);
  const locality = [city, state].filter(Boolean).join(', ');
  const region = [locality, postcode].filter(Boolean).join(' ');
  const address = [street, region].filter(Boolean).join(', ');
  const venueName = name || street || city;
  if (!venueName) return null;
  return { name: venueName, address };
}

export function parsePhotonResponse(body: unknown): VenueSuggestion[] {
  const features = body && typeof body === 'object' && Array.isArray((body as { features?: unknown }).features)
    ? (body as { features: unknown[] }).features
    : [];
  const results: VenueSuggestion[] = [];
  for (const feature of features) {
    const properties = feature && typeof feature === 'object' ? (feature as { properties?: PhotonProperties }).properties : undefined;
    const suggestion = formatPhotonFeature(properties);
    if (!suggestion) continue;
    if (results.some((item) => item.name === suggestion.name && item.address === suggestion.address)) continue;
    results.push(suggestion);
    if (results.length === 5) break;
  }
  return results;
}

export async function searchPhoton(query: string, fetchImpl: typeof fetch = fetch): Promise<VenueSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3 || trimmed.length > 80) return [];
  const key = trimmed.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.results;
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', '5');
  url.searchParams.set('lat', CENTRAL_COAST_FOCUS.lat);
  url.searchParams.set('lon', CENTRAL_COAST_FOCUS.lon);
  url.searchParams.set('lang', 'en');
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': PHOTON_USER_AGENT },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Photon responded ${response.status}`);
  }
  const results = parsePhotonResponse(await response.json());
  cache.set(key, { expires: Date.now() + CACHE_MS, results });
  return results;
}
