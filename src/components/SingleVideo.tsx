'use client';

import { useState } from 'react';

interface SingleVideoProps {
  videoId: string;
  title?: string;
  /**
   * Frame shape. "landscape" (default) is 16:9, matching existing embeds.
   * "portrait" is 9:16 for YouTube Shorts and is capped so it stays a
   * narrow column instead of a letterboxed widescreen player.
   */
  orientation?: 'landscape' | 'portrait';
  /** When false, `title` is used only as the iframe accessible name. */
  showTitle?: boolean;
}

/**
 * Click-to-load YouTube facade: shows the video thumbnail and a play button,
 * and only loads the (youtube-nocookie) player iframe after the visitor taps.
 */
export default function SingleVideo({
  videoId,
  title,
  orientation = 'landscape',
  showTitle = true,
}: SingleVideoProps) {
  const [playing, setPlaying] = useState(false);

  // Owner: a missing id, or one that still starts with TODO, is not shown.
  if (!videoId || videoId.startsWith('TODO')) {
    return null;
  }

  const portrait = orientation === 'portrait';
  const name = title || 'YouTube video player';

  return (
    <div
      className={`rounded-lg overflow-hidden shadow-lg ${
        portrait ? 'mx-auto w-full max-w-[280px]' : ''
      }`}
    >
      {showTitle && title && (
        <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
          {title}
        </h3>
      )}
      <div className={`relative bg-black ${portrait ? 'aspect-[9/16]' : 'aspect-video'}`}>
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1&playsinline=1`}
            title={name}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play video: ${name}`}
            className="group absolute inset-0 w-full h-full focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail, external and tiny */}
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <span className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" aria-hidden="true" />
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-16 h-16 rounded-full bg-red-600 shadow-lg group-hover:scale-110 transition-transform"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="w-8 h-8 ml-1 fill-white"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
