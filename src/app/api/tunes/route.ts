import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    console.log('Fetching tunes from local file');
    
    // Read from local file
    const localTunesPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
    const localTunes = JSON.parse(fs.readFileSync(localTunesPath, 'utf8'));
    
    console.log('Tunes fetched from local file:', localTunes.tunes.length);
    
    return NextResponse.json(localTunes);
  } catch (error) {
    console.error('Error fetching tunes:', error);
    return NextResponse.json(
      { message: 'Failed to fetch tunes', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
