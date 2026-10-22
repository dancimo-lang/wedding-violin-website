export type GoogleEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
};

export function readGoogleEnv(): GoogleEnv | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!clientId || !clientSecret || !redirectUri || !encryptionKey) return null;
  return { clientId, clientSecret, redirectUri, encryptionKey };
}

export function googleConfigured(): boolean {
  return readGoogleEnv() !== null;
}
