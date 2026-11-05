import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { isPdfBytes, sheetBytesLocation } from '@/lib/sheet-pdf';
import { getTunes } from '@/lib/tunes';

function pdfResponse(bytes: Uint8Array, id: string) {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${id.replace(/[^a-z0-9-]/gi, '') || 'sheet'}.pdf"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function readRemotePdf(url: string): Promise<Uint8Array | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
}

function readLocalPdf(relative: string): Uint8Array | null {
  const publicDir = path.join(process.cwd(), 'public');
  const filePath = path.resolve(publicDir, relative);
  if (filePath !== publicDir && !filePath.startsWith(publicDir + path.sep)) return null;
  if (!fs.existsSync(filePath)) return null;
  return new Uint8Array(fs.readFileSync(filePath));
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tunes = await getTunes();
    const tune = tunes.find((item) => item.id === id);
    const location = sheetBytesLocation(tune?.sheetMusicPath);
    if (!location) {
      return NextResponse.json({ message: 'PDF not found' }, { status: 404 });
    }

    const bytes = location.kind === 'remote' ? await readRemotePdf(location.url) : readLocalPdf(location.relative);
    if (!bytes || !isPdfBytes(bytes)) {
      return NextResponse.json({ message: 'PDF not found' }, { status: 404 });
    }

    return pdfResponse(bytes, id);
  } catch (error) {
    console.error('Error fetching PDF:', error);
    return NextResponse.json(
      { message: 'Failed to fetch PDF', error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
