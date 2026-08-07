import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
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

    // Read current tunes from local file
    let tunesData = { tunes: [] };
    try {
      const localTunesPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
      const localTunes = JSON.parse(fs.readFileSync(localTunesPath, 'utf8'));
      tunesData = localTunes;
      console.log('Loaded tunes from local file');
    } catch (localError) {
      console.log('No local tunes.json found, starting fresh');
    }

    console.log('Current tunes count:', tunesData.tunes.length);

    // Check for duplicate ID
    const existingTune = tunesData.tunes.find((t: any) => t.id === id);
    if (existingTune) {
      return NextResponse.json(
        { message: 'A tune with this title already exists', existingTune },
        { status: 409 }
      );
    }

    // Save PDF to local storage
    const docsDir = path.join(process.cwd(), 'public', 'docs');
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }
    
    const pdfPath = path.join(docsDir, `${id}.pdf`);
    const buffer = Buffer.from(await pdf.arrayBuffer());
    fs.writeFileSync(pdfPath, buffer);
    
    console.log('PDF saved locally:', pdfPath);
    const sheetMusicPath = `/docs/${id}.pdf`;

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
      sheetMusicPath,
      tags: tagsArray,
    };

    // Add to tunes
    const updatedTunes = {
      tunes: [...tunesData.tunes, newTune]
    };

    // Write tunes.json to local file
    const localTunesPath = path.join(process.cwd(), 'src', 'data', 'tunes.json');
    fs.writeFileSync(localTunesPath, JSON.stringify(updatedTunes, null, 2));
    console.log('tunes.json saved locally');

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
