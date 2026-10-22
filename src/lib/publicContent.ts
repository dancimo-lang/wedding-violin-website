/** Copy that is still a draft and must not be shown to visitors. */
export function isPlaceholderCopy(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /^(?:\[)?\s*(?:TODO|TBD)\b/i.test(trimmed) || /\blorem\s+ipsum\b/i.test(trimmed);
}

/** True when a string is safe to render: non-empty, not "#" , and not a draft. */
export function isPublishableCopy(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '#') return false;
  return !isPlaceholderCopy(trimmed);
}

/**
 * Google icon stays hidden while an owner note is present, and also when the
 * URL itself is empty or still marked as a draft.
 */
export function publishedGoogleHref(
  url: string | undefined,
  ownerNote: string | undefined,
): string | null {
  if (ownerNote && ownerNote.trim()) return null;
  if (!isPublishableCopy(url)) return null;
  return url ?? null;
}
