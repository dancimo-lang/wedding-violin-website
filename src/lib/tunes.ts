import { list } from '@vercel/blob';
import localTunes from '@/data/tunes.json';

export type Tune = (typeof localTunes.tunes)[number];

export async function getTunes(): Promise<Tune[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return localTunes.tunes;
  }

  try {
    const { blobs } = await list({ prefix: 'tunes.json' });
    if (blobs.length === 0) return localTunes.tunes;

    const response = await fetch(blobs[0].downloadUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });
    if (!response.ok) return localTunes.tunes;

    const data = (await response.json()) as { tunes?: Tune[] };
    if (!Array.isArray(data.tunes)) return localTunes.tunes;
    return data.tunes;
  } catch {
    return localTunes.tunes;
  }
}

function article(word: string) {
  return 'aeiou'.includes(word.charAt(0).toLowerCase()) ? 'an' : 'a';
}

/** Build a ~150–160 character description from fields already shown on the tune page. */
export function tuneDescription(tune: Tune): string {
  const difficulty = tune.difficulty.toLowerCase();
  const lead = `${tune.title} is ${article(difficulty)} ${difficulty} ${tune.type.toLowerCase()} in ${tune.key} by ${tune.composer}`;
  const body = tune.description.replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
  const prefix = `${lead}. `;
  const room = 160 - prefix.length - 1;
  let snippet = body;

  if (snippet.length > room) {
    snippet = snippet.slice(0, Math.max(room, 0));
    const space = snippet.lastIndexOf(' ');
    if (space >= 30) snippet = snippet.slice(0, space);
    snippet = snippet.replace(/[.,;:\s]+$/, '');
  }

  let text = snippet ? `${prefix}${snippet}.` : `${lead}.`;
  const suffixes = [
    tune.youtubeId
      ? ' Sheet music and a video tutorial are included.'
      : ' Sheet music is included.',
    ' In the tune library.',
    ' For violin lessons.',
    ' Sheet music.',
  ];

  for (let guard = 0; text.length < 150 && guard < 4; guard += 1) {
    const suffix = suffixes.find(
      (candidate) => !text.includes(candidate.trim()) && text.length + candidate.length <= 160,
    );
    if (!suffix) break;
    text += suffix;
  }

  if (text.length > 160) {
    const cut = text.slice(0, 160);
    const space = cut.lastIndexOf(' ');
    text = (space >= 140 ? cut.slice(0, space) : cut).replace(/[.,;:\s]+$/, '');
  }

  return text;
}
