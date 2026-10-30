import { type ApiRouteSpec, type PathSegment } from './route-table';

function segmentsMatch(spec: readonly PathSegment[], path: readonly string[]): Record<string, string> | null {
  if (spec.length !== path.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < spec.length; index += 1) {
    const expected = spec[index];
    const actual = path[index];
    if (!actual) return null;
    if (typeof expected === 'string') {
      if (expected !== actual) return null;
    } else {
      params[expected.param] = actual;
    }
  }
  return params;
}

function allowHeader(methods: readonly string[]): string {
  const allowed = new Set(methods);
  if (allowed.has('GET')) allowed.add('HEAD');
  return [...allowed].sort().join(', ');
}

export type ApiMatchOf<T extends ApiRouteSpec> =
  | { kind: 'ok'; route: T; params: Record<string, string> }
  | { kind: 'method'; allow: string }
  | { kind: 'miss' };

/** Match a catch-all path. HEAD is treated as GET so Next's automatic HEAD keeps working. */
export function matchApiRoute<T extends ApiRouteSpec>(
  method: string,
  path: readonly string[],
  routes: readonly T[],
): ApiMatchOf<T> {
  const normalizedMethod = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase();
  const normalizedPath = path.filter((segment) => segment.length > 0);
  const samePath = routes.filter((route) => segmentsMatch(route.segments, normalizedPath));
  if (samePath.length === 0) return { kind: 'miss' };

  const route = samePath.find((candidate) => candidate.methods.includes(normalizedMethod));
  if (!route) {
    const methods = samePath.flatMap((candidate) => [...candidate.methods]);
    return { kind: 'method', allow: allowHeader(methods) };
  }

  return {
    kind: 'ok',
    route,
    params: segmentsMatch(route.segments, normalizedPath) ?? {},
  };
}
