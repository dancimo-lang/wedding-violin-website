import { put } from '@vercel/blob';
import { readFileSync } from 'fs';
import path from 'path';
import tunes from '@/data/tunes.json';

async function initializeVercelBlob() {
  console.log('Initializing Vercel Blob with existing tunes...');
  
  try {
    // Upload tunes.json to Vercel Blob
    console.log('Uploading tunes.json...');
    await put('tunes.json', JSON.stringify(tunes, null, 2), {
      access: 'public',
    });
    console.log('tunes.json uploaded successfully');

    // Upload existing PDF files
    console.log('Uploading existing PDF files...');
    const docsDir = path.join(process.cwd(), 'public', 'docs');
    
    for (const tune of tunes.tunes) {
      if (tune.sheetMusicPath.startsWith('/docs/')) {
        const fileName = tune.sheetMusicPath.replace('/docs/', '');
        const filePath = path.join(docsDir, fileName);
        
        try {
          const fileBuffer = readFileSync(filePath);
          const blob = await put(fileName, fileBuffer, {
            access: 'public',
          });
          
          console.log(`Uploaded ${fileName} to ${blob.url}`);
          
          // Update the tune's sheetMusicPath to use the Vercel Blob URL
          tune.sheetMusicPath = blob.url;
        } catch (error) {
          console.error(`Failed to upload ${fileName}:`, error);
        }
      }
    }

    // Update tunes.json with new Vercel Blob URLs
    console.log('Updating tunes.json with Vercel Blob URLs...');
    await put('tunes.json', JSON.stringify(tunes, null, 2), {
      access: 'public',
    });
    console.log('tunes.json updated successfully');

    console.log('Vercel Blob initialization complete!');
  } catch (error) {
    console.error('Error initializing Vercel Blob:', error);
  }
}

initializeVercelBlob();
