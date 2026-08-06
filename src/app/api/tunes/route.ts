import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export async function GET() {
  try {
    console.log('Fetching tunes from Vercel Blob');
    
    const { blobs } = await list({ prefix: 'tunes.json' });
    
    if (blobs.length === 0) {
      console.log('No tunes.json found in Vercel Blob');
      return NextResponse.json({ tunes: [] });
    }

    const response = await fetch(blobs[0].downloadUrl);
    const tunesJsonContent = await response.text();
    const tunesData = JSON.parse(tunesJsonContent);
    
    console.log('Tunes fetched successfully:', tunesData.tunes.length);
    
    return NextResponse.json(tunesData);
  } catch (error) {
    console.error('Error fetching tunes:', error);
    return NextResponse.json(
      { message: 'Failed to fetch tunes', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
