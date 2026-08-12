import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log('Fetching PDF proxy for:', id);
    
    // Get the tune data to find the PDF URL
    const tunesResponse = await fetch(`${request.nextUrl.origin}/api/tunes`);
    const tunesData = await tunesResponse.json();
    
    const tune = tunesData.tunes?.find((t: any) => t.id === id);
    
    if (!tune || !tune.sheetMusicPath) {
      return NextResponse.json({ message: 'PDF not found' }, { status: 404 });
    }
    
    console.log('Fetching PDF from:', tune.sheetMusicPath);
    
    // Fetch the PDF from the Blob URL
    const pdfResponse = await fetch(tune.sheetMusicPath);
    
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.status}`);
    }
    
    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${id}.pdf"`,
        'Cache-Control': 'public, max-age=31536000',
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
