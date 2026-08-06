import { NextResponse } from 'next/server';
import tunes from '@/data/tunes.json';

export async function GET() {
  try {
    console.log('Fetching tunes from local tunes.json');
    console.log('Tunes count:', tunes.tunes.length);
    
    return NextResponse.json(tunes);
  } catch (error) {
    console.error('Error fetching tunes:', error);
    return NextResponse.json(
      { message: 'Failed to fetch tunes', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
