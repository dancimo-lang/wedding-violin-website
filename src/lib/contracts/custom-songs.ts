export const CUSTOM_SONG_COUNT = 3;
export const CUSTOM_SONG_MAX = 160;

export type CustomSongs = [string, string, string];

export function emptyCustomSongs(): CustomSongs {
  return ['', '', ''];
}

/** Three single-line song titles. Extra lines and characters are dropped. */
export function normalizeCustomSongs(input: unknown): CustomSongs {
  const raw = Array.isArray(input) ? input : [];
  return [0, 1, 2].map((index) => {
    const value = typeof raw[index] === 'string' ? raw[index] : '';
    return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CUSTOM_SONG_MAX);
  }) as CustomSongs;
}

export function customSongsNote(songs: readonly string[]): string {
  return JSON.stringify({ kind: 'custom-songs', songs: normalizeCustomSongs(songs) });
}

/** Reads a notes.content value. Anything else is not a custom-song note. */
export function readCustomSongsNote(content: string | null | undefined): CustomSongs | null {
  if (!content || !content.includes('"custom-songs"')) return null;
  try {
    const parsed = JSON.parse(content) as { kind?: unknown; songs?: unknown };
    if (parsed.kind !== 'custom-songs') return null;
    return normalizeCustomSongs(parsed.songs);
  } catch {
    return null;
  }
}
