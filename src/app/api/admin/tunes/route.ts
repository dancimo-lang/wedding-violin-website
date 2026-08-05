import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { readFileSync } from 'fs';

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

    // Create docs directory if it doesn't exist
    const docsDir = path.join(process.cwd(), 'public', 'docs');
    console.log('Docs directory:', docsDir);
    if (!existsSync(docsDir)) {
      console.log('Creating docs directory');
      await mkdir(docsDir, { recursive: true });
    }

    // Save PDF file
    const pdfFileName = `${id}.pdf`;
    const pdfPath = path.join(docsDir, pdfFileName);
    console.log('Saving PDF to:', pdfPath);
    const bytes = await pdf.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(pdfPath, buffer);
    console.log('PDF saved successfully');

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

    // Read current tunes.json
    console.log('Reading tunes.json');
    const tunesJsonPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
    const tunesJsonContent = readFileSync(tunesJsonPath, 'utf-8');
    const tunesData = JSON.parse(tunesJsonContent);
    console.log('Current tunes count:', tunesData.tunes.length);

    // Add to tunes.json
    const updatedTunes = {
      tunes: [...tunesData.tunes, newTune]
    };

    // Write to tunes.json
    console.log('Writing updated tunes.json');
    await writeFile(tunesJsonPath, JSON.stringify(updatedTunes, null, 2));
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
