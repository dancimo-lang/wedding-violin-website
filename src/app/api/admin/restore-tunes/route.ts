import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    console.log('Reading local tunes.json...');
    const localTunesPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
    const localTunes = JSON.parse(fs.readFileSync(localTunesPath, 'utf8'));
    console.log(`Found ${localTunes.tunes.length} tunes in local file`);

    console.log('Uploading to Vercel Blob Storage...');
    const blob = await put('tunes.json', JSON.stringify(localTunes, null, 2), {
      access: 'private',
      allowOverwrite: true,
    });

    console.log('✅ tunes.json restored successfully to Vercel Blob');
    
    return NextResponse.json({ 
      message: 'Tunes restored successfully', 
      count: localTunes.tunes.length,
      blobUrl: blob.url 
    });
  } catch (error) {
    console.error('❌ Error restoring tunes:', error);
    return NextResponse.json(
      { message: 'Failed to restore tunes', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
