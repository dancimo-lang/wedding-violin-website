import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAdminApi } from '@/lib/require-admin-api';
import {
  cleanPracticeTips,
  fileExtension,
  isTuneId,
  practiceTipsError,
  validateScoreFile,
} from '@/lib/tune-files';
import { loadTunesDocument, saveTunesDocument } from '@/lib/tunes-store';

function readUpload(value: FormDataEntryValue | null): File | null {
  if (!(value instanceof File) || value.size <= 0) return null;
  return value;
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const tunesData = await loadTunesDocument();
    const updated = {
      ...tunesData,
      tunes: tunesData.tunes.filter((tune) => tune.id !== id),
    };
    await saveTunesDocument(updated);
    return NextResponse.json({ message: 'Tune deleted successfully', id }, { status: 200 });
  } catch (error) {
    console.error('Error deleting tune:', error);
    return NextResponse.json(
      { message: 'Failed to delete tune', error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    if (!isTuneId(id)) {
      return NextResponse.json({ message: 'That tune could not be found.' }, { status: 404 });
    }

    const formData = await request.formData();
    if (!formData.has('practiceTips')) {
      return NextResponse.json({ message: 'Practice tips are missing.' }, { status: 400 });
    }
    const practiceTips = cleanPracticeTips(String(formData.get('practiceTips') ?? ''));
    const tipsError = practiceTipsError(practiceTips);
    if (tipsError) return NextResponse.json({ message: tipsError }, { status: 400 });

    const score = readUpload(formData.get('score'));
    if (score) {
      const scoreError = validateScoreFile(score);
      if (scoreError) return NextResponse.json({ message: scoreError }, { status: 400 });
    }

    const tunesData = await loadTunesDocument();
    const index = tunesData.tunes.findIndex((tune) => tune.id === id);
    if (index < 0) {
      return NextResponse.json({ message: 'That tune could not be found.' }, { status: 404 });
    }

    const next: Record<string, unknown> = { ...tunesData.tunes[index], id };
    if (practiceTips) next.practiceTips = practiceTips;
    else delete next.practiceTips;

    if (score) {
      const extension = fileExtension(score.name);
      const blob = await put(`${id}${extension}`, score, {
        access: 'public',
        allowOverwrite: true,
      });
      next.museScorePath = blob.url;
    }

    const tunes = [...tunesData.tunes];
    tunes[index] = next as (typeof tunes)[number];
    await saveTunesDocument({ ...tunesData, tunes });
    return NextResponse.json({ message: 'Tune updated successfully', tune: next }, { status: 200 });
  } catch (error) {
    console.error('Error updating tune:', error);
    return NextResponse.json(
      { message: 'Failed to update tune', error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
