'use client';

import { Suspense } from 'react';

interface YouTubePlaylistProps {
  playlistId: string;
}

export default function YouTubePlaylist({ playlistId }: YouTubePlaylistProps) {
  // Owner: a missing id, or one that still starts with TODO, is not shown.
  if (!playlistId || playlistId.startsWith('TODO')) {
    return null;
  }

  return (
    <div className="rounded-lg overflow-hidden shadow-lg">
      <Suspense fallback={
        <div className="aspect-video bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
          <span className="text-gray-400">Loading videos...</span>
        </div>
      }>
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/videoseries?list=${playlistId}`}
            title="YouTube video playlist player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      </Suspense>
    </div>
  );
}
