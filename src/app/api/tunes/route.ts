import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

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
      
      return NextResponse.json(tunesData);
    } catch (blobError) {
      console.log('Blob storage failed, falling back to local file:', blobError instanceof Error ? blobError.message : String(blobError));
      
      // Fallback to local file
      const localTunesPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
      const localTunes = JSON.parse(fs.readFileSync(localTunesPath, 'utf8'));
      
      console.log('Tunes fetched from local file:', localTunes.tunes.length);
      
      return NextResponse.json(localTunes);
    }
  } catch (error) {
    console.error('Error fetching tunes:', error);
    return NextResponse.json(
      { message: 'Failed to fetch tunes', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
