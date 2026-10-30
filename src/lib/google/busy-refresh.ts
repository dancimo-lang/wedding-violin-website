/** At most one on-demand busy refresh attempt per window, across all requests. */
export const BUSY_REFRESH_THROTTLE_MS = 5 * 60 * 1000;
/** The public check waits this long for Google before answering without it. */
export const BUSY_REFRESH_TIMEOUT_MS = 4500;

export type BusyRefreshDeps = {
  /** Atomically claim the refresh slot. False when another attempt ran recently. */
  claim(now: Date): Promise<boolean>;
  /** Read Google busy times and store them. True when fresh rows were saved. */
  refresh(now: Date): Promise<boolean>;
  timeoutMs?: number;
};

/**
 * Refresh stale busy times before a public answer. Never throws; any claim
 * failure, refresh error, or timeout returns false so the caller keeps the
 * stale state and answers requires_manual_confirmation as before.
 */
export async function refreshStaleBusy(deps: BusyRefreshDeps, now = new Date()): Promise<boolean> {
  let claimed = false;
  try {
    claimed = await deps.claim(now);
  } catch {
    return false;
  }
  if (!claimed) return false;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), deps.timeoutMs ?? BUSY_REFRESH_TIMEOUT_MS);
  });
  try {
    return await Promise.race([deps.refresh(now).then((ok) => ok === true, () => false), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
