import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log('Deleting tune:', id);

    // Read current tunes - try Blob first, fallback to local
    let tunesData = { tunes: [] };
    
    try {
      const { blobs } = await list({ prefix: 'tunes.json' });
      if (blobs.length > 0) {
        const response = await fetch(blobs[0].downloadUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
        }
      });
        const tunesJsonContent = await response.text();
        tunesData = JSON.parse(tunesJsonContent);
        console.log('Loaded tunes from Blob storage');
      }
    } catch (error) {
      console.log('Blob storage failed, reading from local file');
      // Fallback to local file if Blob is empty
      try {
        const localTunesPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
        const localTunes = JSON.parse(fs.readFileSync(localTunesPath, 'utf8'));
        tunesData = localTunes;
      } catch (localError) {
        console.log('No local tunes.json found either');
      }
    }

    // Remove the tune with the given id
    const updatedTunes = {
      tunes: tunesData.tunes.filter((t: any) => t.id !== id)
    };

    // Write tunes.json - try Blob first, fallback to local
    try {
      console.log('Writing updated tunes.json to Vercel Blob');
      await put('tunes.json', JSON.stringify(updatedTunes, null, 2), {
        access: 'private',
        allowOverwrite: true,
      });
      console.log('tunes.json updated successfully in Blob');
    } catch (blobError) {
      console.log('Blob storage failed for tunes.json, saving locally:', blobError instanceof Error ? blobError.message : String(blobError));
      
      // Fallback to local file
      const localTunesPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
      fs.writeFileSync(localTunesPath, JSON.stringify(updatedTunes, null, 2));
      console.log('tunes.json saved locally');
    }

    return NextResponse.json(
      { message: 'Tune deleted successfully', id },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting tune:', error);
    return NextResponse.json(
      { message: 'Failed to delete tune', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
