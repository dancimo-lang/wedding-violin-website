import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAdminApi } from '@/lib/require-admin-api';
import {
  cleanPracticeTips,
  fileExtension,
  isTuneId,
  practiceTipsError,
  validateScoreFile,
  validateSheetMusicFile,
} from '@/lib/tune-files';
import { loadTunesDocument, saveTunesDocument, type StoredTune } from '@/lib/tunes-store';

function readUpload(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof File) || value.size <= 0) return null;
  return value;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  try {
    const formData = await request.formData();
    const title = String(formData.get('title') ?? '');
    const type = String(formData.get('type') ?? '');
    const key = String(formData.get('key') ?? '');
    const composer = String(formData.get('composer') ?? '');
    const difficulty = String(formData.get('difficulty') ?? '');
    const description = String(formData.get('description') ?? '');
    const youtubeId = String(formData.get('youtubeId') ?? '');
    const tags = String(formData.get('tags') ?? '');
    const pdf = readUpload(formData.get('pdf'));
    const score = readUpload(formData.get('score'));
    const practiceTips = cleanPracticeTips(String(formData.get('practiceTips') ?? ''));

    if (!title || !type || !key || !composer || !difficulty || !description || !pdf) {
      return NextResponse.json(
        { message: 'Missing required fields', missing: { title, type, key, composer, difficulty, description, pdf: !!pdf } },
        { status: 400 },
      );
    }

    const pdfError = validateSheetMusicFile(pdf);
    if (pdfError) return NextResponse.json({ message: pdfError }, { status: 400 });
    if (score) {
      const scoreError = validateScoreFile(score);
      if (scoreError) return NextResponse.json({ message: scoreError }, { status: 400 });
    }
    const tipsError = practiceTipsError(practiceTips);
    if (tipsError) return NextResponse.json({ message: tipsError }, { status: 400 });

    const id = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!isTuneId(id)) {
      return NextResponse.json({ message: 'Use a title with letters or numbers.' }, { status: 400 });
    }

    const tunesData = await loadTunesDocument();
    const existingTune = tunesData.tunes.find((tune) => tune.id === id);
    if (existingTune) {
      return NextResponse.json({ message: 'A tune with this title already exists', existingTune }, { status: 409 });
    }

    const pdfBlob = await put(`${id}.pdf`, pdf, {
      access: 'public',
      allowOverwrite: true,
    });
    let museScorePath = '';
    if (score) {
      const extension = fileExtension(score.name);
      const scoreBlob = await put(`${id}${extension}`, score, {
        access: 'public',
        allowOverwrite: true,
      });
      museScorePath = scoreBlob.url;
    }

    const tagsArray = tags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0);

    const newTune: StoredTune = {
      id,
      title,
      type,
      key,
      composer,
      difficulty,
      description,
      youtubeId: youtubeId || '',
      sheetMusicPath: pdfBlob.url,
      tags: tagsArray,
      ...(practiceTips ? { practiceTips } : {}),
      ...(museScorePath ? { museScorePath } : {}),
    };

    await saveTunesDocument({
      ...tunesData,
      tunes: [...tunesData.tunes, newTune],
    });

    return NextResponse.json({ message: 'Tune added successfully', tune: newTune }, { status: 200 });
  } catch (error) {
    console.error('Error adding tune:', error);
    return NextResponse.json(
      { message: 'Failed to add tune', error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
