import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import tunes from '@/data/tunes.json';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const key = formData.get('key') as string;
    const composer = formData.get('composer') as string;
    const difficulty = formData.get('difficulty') as string;
    const description = formData.get('description') as string;
    const youtubeId = formData.get('youtubeId') as string;
    const tags = formData.get('tags') as string;
    const pdf = formData.get('pdf') as File;

    if (!title || !type || !key || !composer || !difficulty || !description || !pdf) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate ID from title
    const id = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Create docs directory if it doesn't exist
    const docsDir = path.join(process.cwd(), 'public', 'docs');
    if (!existsSync(docsDir)) {
      await mkdir(docsDir, { recursive: true });
    }

    // Save PDF file
    const pdfFileName = `${id}.pdf`;
    const pdfPath = path.join(docsDir, pdfFileName);
    const bytes = await pdf.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(pdfPath, buffer);

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
      sheetMusicPath: `/docs/${pdfFileName}`,
      tags: tagsArray,
    };

    // Add to tunes.json
    const updatedTunes = {
      tunes: [...tunes.tunes, newTune]
    };

    // Write to tunes.json
    const tunesJsonPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
    await writeFile(tunesJsonPath, JSON.stringify(updatedTunes, null, 2));

    return NextResponse.json(
      { message: 'Tune added successfully', tune: newTune },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error adding tune:', error);
    return NextResponse.json(
      { message: 'Failed to add tune' },
      { status: 500 }
    );
  }
}
