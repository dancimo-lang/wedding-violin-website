import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

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
      access: 'private',
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
      sheetMusicPath: blob.downloadUrl,
      tags: tagsArray,
    };

    // Update local tunes.json
    console.log('Updating local tunes.json');
    const tunesJsonPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
    const tunesJsonContent = readFileSync(tunesJsonPath, 'utf-8');
    const tunesData = JSON.parse(tunesJsonContent);
    
    const updatedTunes = {
      tunes: [...tunesData.tunes, newTune]
    };

    writeFileSync(tunesJsonPath, JSON.stringify(updatedTunes, null, 2));
    console.log('Local tunes.json updated successfully');

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
