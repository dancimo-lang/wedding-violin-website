import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    console.log('API route called');
    const formData = await request.formData();
    console.log('FormData received');
    
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const key = formData.get('key') as string;
    const composer = formData.get('composer') as string;
    const difficulty = formData.get('difficulty') as string;
    const description = formData.get('description') as string;
    const youtubeId = formData.get('youtubeId') as string;
    const tags = formData.get('tags') as string;
    const pdf = formData.get('pdf') as File;

    console.log('Form data parsed:', { title, type, key, composer, difficulty, description, youtubeId, tags, hasPdf: !!pdf });

    if (!title || !type || !key || !composer || !difficulty || !description || !pdf) {
      return NextResponse.json(
        { message: 'Missing required fields', missing: { title, type, key, composer, difficulty, description, pdf: !!pdf } },
        { status: 400 }
      );
    }

    // Generate ID from title
    const id = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    console.log('Generated ID:', id);

    // Save PDF to Vercel Blob Storage
    const pdfFileName = `${id}.pdf`;
    console.log('Uploading PDF to Vercel Blob Storage');
    
    const blob = await put(pdfFileName, pdf, {
      access: 'public',
      allowOverwrite: true,
    });
    
    console.log('PDF uploaded successfully:', blob.downloadUrl);

    // Parse tags
    const tagsArray = tags
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);

    // Create new tune object
    const newTune = {
      id,
      title,
      type,
      key,
      composer,
      difficulty,
      description,
      youtubeId: youtubeId || '',
      sheetMusicPath: blob.url,
      tags: tagsArray,
    };

    // Read current tunes from Vercel Blob
    console.log('Reading tunes.json from Vercel Blob');
    let tunesData = { tunes: [] };
    
    try {
      const { blobs } = await list({ prefix: 'tunes.json' });
      if (blobs.length > 0) {
        const response = await fetch(blobs[0].url);
        const tunesJsonContent = await response.text();
        tunesData = JSON.parse(tunesJsonContent);
      }
    } catch (error) {
      console.log('No existing tunes.json found, creating new one');
    }

    console.log('Current tunes count:', tunesData.tunes.length);

    // Add to tunes
    const updatedTunes = {
      tunes: [...tunesData.tunes, newTune]
    };

    // Write to Vercel Blob
    console.log('Writing updated tunes.json to Vercel Blob');
    await put('tunes.json', JSON.stringify(updatedTunes, null, 2), {
      access: 'public',
      allowOverwrite: true,
    });
    console.log('tunes.json updated successfully');

    return NextResponse.json(
      { message: 'Tune added successfully', tune: newTune },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error adding tune:', error);
    return NextResponse.json(
      { message: 'Failed to add tune', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
