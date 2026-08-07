import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log('Fetching PDF:', id);
    
    try {
      const { blobs } = await list({ prefix: `${id}.pdf` });
      console.log('Found PDF blobs:', blobs.length);
      
      if (blobs.length === 0) {
        console.log('No PDF found in Blob storage, falling back to local file');
        throw new Error('No blobs found');
      }

      const response = await fetch(blobs[0].downloadUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      
      const pdfBuffer = await response.arrayBuffer();
      
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${id}.pdf"`,
        },
      });
    } catch (blobError) {
      console.log('Blob storage failed, falling back to local file:', blobError instanceof Error ? blobError.message : String(blobError));
      
      // Fallback to local file - check common locations
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
        return NextResponse.json({ message: 'PDF not found in Blob or local storage' }, { status: 404 });
      }
      
      console.log('Serving PDF from local file:', pdfPath);
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${id}.pdf"`,
        },
      });
    }
  } catch (error) {
    console.error('Error fetching PDF:', error);
    return NextResponse.json(
      { message: 'Failed to fetch PDF', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
