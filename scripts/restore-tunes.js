const { put } = require('@vercel/blob');
const fs = require('fs');

async function restoreTunes() {
  try {
    console.log('Reading local tunes.json...');
    const localTunes = JSON.parse(fs.readFileSync('./src/data/tunes.json', 'utf8'));
    console.log(`Found ${localTunes.tunes.length} tunes in local file`);

    console.log('Uploading to Vercel Blob Storage...');
    const blob = await put('tunes.json', JSON.stringify(localTunes, null, 2), {
      access: 'private',
      allowOverwrite: true,
    });

    console.log('✅ tunes.json restored successfully to Vercel Blob');
    console.log(`Blob URL: ${blob.url}`);
  } catch (error) {
    console.error('❌ Error restoring tunes:', error);
    process.exit(1);
  }
}

restoreTunes();
