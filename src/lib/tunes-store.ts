import 'server-only';
import { list, put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

export type StoredTune = { id: string; [key: string]: unknown };

export type TunesDocument = {
  tunes: StoredTune[];
  [key: string]: unknown;
};

function asDocument(value: unknown): TunesDocument | null {
  if (!value || typeof value !== 'object') return null;
  const tunes = (value as { tunes?: unknown }).tunes;
  if (!Array.isArray(tunes)) return null;
  return value as TunesDocument;
}

/**
 * Read tunes.json from Blob, then the repo file. An empty Blob starts a new
 * document. A Blob error falls back to the local file, matching the admin routes.
 */
export async function loadTunesDocument(): Promise<TunesDocument> {
  try {
    const { blobs } = await list({ prefix: 'tunes.json' });
    if (blobs.length === 0) return { tunes: [] };
    const response = await fetch(blobs[0].downloadUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });
    if (!response.ok) throw new Error(`Failed to fetch tunes.json: ${response.status}`);
    const parsed = asDocument(JSON.parse(await response.text()));
    if (!parsed) return { tunes: [] };
    return parsed;
  } catch (error) {
    console.log(
      'Blob storage failed, reading from local file:',
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    const localTunesPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
    const parsed = asDocument(JSON.parse(fs.readFileSync(localTunesPath, 'utf8')));
    if (!parsed) return { tunes: [] };
    return parsed;
  } catch {
    return { tunes: [] };
  }
}

export async function saveTunesDocument(document: TunesDocument): Promise<void> {
  await put('tunes.json', JSON.stringify(document, null, 2), {
    access: 'public',
    allowOverwrite: true,
  });
}
