import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import fs from 'fs';
import path from 'path';
import { isPublishableCopy } from '@/lib/publicContent';
import { cleanPracticeTips, downloadExtension, isScoreExtension, PRACTICE_TIPS_MAX } from '@/lib/tune-files';

function publishedSheetMusicPath(sheetMusicPath: unknown): string {
  if (typeof sheetMusicPath !== 'string' || !isPublishableCopy(sheetMusicPath)) {
    return '';
  }
  if (/^https?:\/\//i.test(sheetMusicPath)) {
    return sheetMusicPath;
  }
  const relative = sheetMusicPath.replace(/^\/+/, '');
  if (!relative || relative.includes('..')) {
    return '';
  }
  const filePath = path.join(process.cwd(), 'public', relative);
  return fs.existsSync(filePath) ? sheetMusicPath : '';
}

function publishedPracticeTips(value: unknown): string {
  if (typeof value !== 'string') return '';
  const cleaned = cleanPracticeTips(value).slice(0, PRACTICE_TIPS_MAX);
  return isPublishableCopy(cleaned) ? cleaned : '';
}

function publishedScorePath(scorePath: unknown): string {
  if (typeof scorePath !== 'string' || !isPublishableCopy(scorePath)) return '';
  if (!isScoreExtension(downloadExtension(scorePath))) return '';
  if (/^https?:\/\//i.test(scorePath)) return scorePath;
  const relative = scorePath.replace(/^\/+/, '');
  if (!relative || relative.includes('..')) return '';
  const filePath = path.join(process.cwd(), 'public', relative);
  return fs.existsSync(filePath) ? scorePath : '';
}

function sanitizeTunesPayload(data: { tunes?: Array<Record<string, unknown>> }) {
  return {
    tunes: (data.tunes ?? []).map((tune) => {
      const youtubeId = typeof tune.youtubeId === 'string' && isPublishableCopy(tune.youtubeId)
        ? tune.youtubeId
        : '';
      const practiceTips = publishedPracticeTips(tune.practiceTips);
      const museScorePath = publishedScorePath(tune.museScorePath);
      return {
        ...tune,
        ownerNote: undefined,
        mediaNote: undefined,
        youtubeId,
        sheetMusicPath: publishedSheetMusicPath(tune.sheetMusicPath),
        practiceTips: practiceTips || undefined,
        museScorePath: museScorePath || undefined,
      };
    }),
  };
}

export async function GET() {
  try {
    console.log('Fetching tunes from Vercel Blob');

    try {
      const { blobs } = await list({ prefix: 'tunes.json' });
      console.log('Found blobs:', blobs.length);

      if (blobs.length === 0) {
        console.log('No tunes.json found in Vercel Blob, falling back to local file');
        throw new Error('No blobs found');
      }

      console.log('Fetching from:', blobs[0].downloadUrl);
      const response = await fetch(blobs[0].downloadUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tunes.json: ${response.status} ${response.statusText}`);
      }

      const tunesJsonContent = await response.text();
      const tunesData = JSON.parse(tunesJsonContent);

      console.log('Tunes fetched successfully from Blob:', tunesData.tunes.length);

      return NextResponse.json(sanitizeTunesPayload(tunesData));
    } catch (blobError) {
      console.log('Blob storage failed, falling back to local file:', blobError instanceof Error ? blobError.message : String(blobError));

      // Fallback to local file
      const localTunesPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
      const localTunes = JSON.parse(fs.readFileSync(localTunesPath, 'utf8'));

      console.log('Tunes fetched from local file:', localTunes.tunes.length);

      return NextResponse.json(sanitizeTunesPayload(localTunes));
    }
  } catch (error) {
    console.error('Error fetching tunes:', error);
    return NextResponse.json(
      { message: 'Failed to fetch tunes', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
