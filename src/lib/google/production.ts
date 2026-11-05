/**
 * Production is only VERCEL_ENV === 'production'. Preview and local dev must not
 * create, update, or delete Google Calendar events. NODE_ENV is not used:
 * Vercel sets it to production on preview builds too.
 */
export function isProductionCalendarEnvironment(env?: { VERCEL_ENV?: string }): boolean {
  const vercelEnv = env ? env.VERCEL_ENV : process.env.VERCEL_ENV;
  return vercelEnv?.trim() === 'production';
}
