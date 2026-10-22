import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

const photoCache = new Map<string, string>();

async function photoDataUrl(filename: string): Promise<string> {
  const cached = photoCache.get(filename);
  if (cached) return cached;

  const input = await readFile(join(process.cwd(), 'public/images', filename));
  const resized = await sharp(input)
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82 })
    .toBuffer();
  const url = `data:image/jpeg;base64,${resized.toString('base64')}`;
  photoCache.set(filename, url);
  return url;
}

function headlineFontSize(headline: string) {
  if (headline.length > 40) return 42;
  if (headline.length > 28) return 50;
  return 58;
}

/** Compose an existing site photo with the business name at the Open Graph size. */
export async function createOgImage(photoFile: string, headline: string) {
  const photo = await photoDataUrl(photoFile);
  const fontSize = headlineFontSize(headline);

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: 'flex',
          position: 'relative',
          backgroundColor: '#0a1628',
        }}
      >
        {/* Satori renders this photo; it is not a page image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          width={WIDTH}
          height={HEIGHT}
          alt=""
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: WIDTH,
            height: HEIGHT,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: WIDTH,
            height: 300,
            display: 'flex',
            backgroundImage:
              'linear-gradient(to top, rgba(10,22,40,0.96) 0%, rgba(10,22,40,0.78) 48%, rgba(10,22,40,0) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 56,
            bottom: 48,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 48,
                height: 4,
                backgroundColor: '#00aeef',
                marginRight: 16,
              }}
            />
            <div
              style={{
                fontSize: 22,
                letterSpacing: 4,
                color: '#7ad7ff',
              }}
            >
              DANIEL CIMO
            </div>
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize,
              lineHeight: 1.05,
              color: '#ffffff',
              width: 1080,
            }}
          >
            {headline}
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
