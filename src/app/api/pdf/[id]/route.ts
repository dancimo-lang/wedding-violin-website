import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log('Fetching PDF:', id);
    
    // Check local file locations
    const possiblePaths = [
      path.join(process.cwd(), 'public', 'docs', `${id}.pdf`),
      path.join(process.cwd(), 'public', 'sheet-music', `${id}.pdf`),
      path.join(process.cwd(), 'public', 'docs', `${id.replace(/-/g, ' ')}.pdf`),
      path.join(process.cwd(), 'public', 'sheet-music', `${id.replace(/-/g, ' ')}.pdf`),
    ];
    
    let pdfPath = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        pdfPath = possiblePath;
        break;
      }
    }
    
    if (!pdfPath) {
      console.log('PDF not found in local storage for:', id);
      return NextResponse.json({ message: 'PDF not found' }, { status: 404 });
    }
    
    console.log('Serving PDF from local file:', pdfPath);
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error fetching PDF:', error);
    return NextResponse.json(
      { message: 'Failed to fetch PDF', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
