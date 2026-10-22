/**
 * Standard secret keys use sk_test_ / sk_live_. Restricted keys use rk_test_ / rk_live_.
 * Publishable keys (pk_) stay rejected.
 */
export function isStripeSecretKey(value: string | null | undefined): boolean {
  const key = value?.trim() ?? '';
  return key.startsWith('sk_') || key.startsWith('rk_');
}
