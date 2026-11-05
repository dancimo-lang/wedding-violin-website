export const TEMPO_PERCENT_MIN = 40;
export const TEMPO_PERCENT_MAX = 120;

export type LoopRange = { from: number; to: number };

export function clampTempoPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 100;
  return Math.min(TEMPO_PERCENT_MAX, Math.max(TEMPO_PERCENT_MIN, Math.round(percent)));
}

/** BPM heard at a percentage of the written tempo. 100% keeps the written tempo. */
export function playbackBpm(writtenBpm: number, percent: number): number {
  const written = Number.isFinite(writtenBpm) && writtenBpm > 0 ? writtenBpm : 120;
  return Math.max(1, Math.round((written * clampTempoPercent(percent)) / 100));
}

/** Step length at a slower or faster tempo. 40% lasts longer than the written step. */
export function scaledStepMs(writtenMs: number, percent: number): number {
  const ms = Number.isFinite(writtenMs) && writtenMs > 0 ? writtenMs : 0;
  return ms / (clampTempoPercent(percent) / 100);
}

/**
 * Next playback step. A loop range uses measure numbers (1-based) and wraps
 * to the first step inside the range. No loop ends after the last step.
 */
export function stepAfter(index: number, measures: readonly number[], loop: LoopRange | null): number {
  const count = measures.length;
  if (index < 0 || index >= count) return -1;
  const next = index + 1;
  if (!loop) return next >= count ? -1 : next;
  const from = Math.min(loop.from, loop.to);
  const to = Math.max(loop.from, loop.to);
  const inLoop = (step: number) => measures[step] >= from && measures[step] <= to;
  if (next < count && inLoop(next)) return next;
  if (inLoop(index)) return measures.findIndex((_, step) => inLoop(step));
  return next >= count ? -1 : next;
}
