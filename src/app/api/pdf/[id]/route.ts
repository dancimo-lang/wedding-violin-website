import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    console.log('Fetching PDF:', id);
    
    const { blobs } = await list({ prefix: `${id}.pdf` });
    console.log('Found PDF blobs:', blobs.length);
    
    if (blobs.length === 0) {
      return NextResponse.json({ message: 'PDF not found' }, { status: 404 });
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
  } catch (error) {
    console.error('Error fetching PDF:', error);
    return NextResponse.json(
      { message: 'Failed to fetch PDF', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
