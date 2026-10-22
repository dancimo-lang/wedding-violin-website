export function paymentPageUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/pay?t=${encodeURIComponent(token)}`;
}

export function siteOrigin(request?: Request): string {
  const configured = process.env.CONTRACT_PUBLIC_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (request) {
    const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? '';
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    if (/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return `${proto}://${host}`;
    try {
      return new URL(request.url).origin;
    } catch {
      return 'https://danielcimo.com';
    }
  }
  return 'https://danielcimo.com';
}
