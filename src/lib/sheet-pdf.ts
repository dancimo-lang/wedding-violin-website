import { isPublishableCopy } from '@/lib/publicContent';

export type SheetLocation =
  | { kind: 'remote'; url: string }
  | { kind: 'file'; relative: string };

/**
 * Where the PDF bytes live. Remote URLs are fetched directly. A site path is
 * read from public/ on disk. Neither path goes back through this site's HTTP
 * API, which on a protected preview returns the login page instead of JSON.
 */
export function sheetBytesLocation(sheetMusicPath: string | null | undefined): SheetLocation | null {
  if (typeof sheetMusicPath !== 'string' || !isPublishableCopy(sheetMusicPath)) return null;
  if (/^https?:\/\//i.test(sheetMusicPath)) {
    try {
      const url = new URL(sheetMusicPath);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return { kind: 'remote', url: url.toString() };
    } catch {
      return null;
    }
  }
  const relative = sheetMusicPath.replace(/^\/+/, '');
  if (!relative || relative.includes('..') || relative.includes('\\') || relative.includes('\0') || relative.includes(':')) return null;
  return { kind: 'file', relative };
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
