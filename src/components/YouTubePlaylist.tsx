'use client';

import { Suspense } from 'react';

interface YouTubePlaylistProps {
  playlistId: string;
}

export default function YouTubePlaylist({ playlistId }: YouTubePlaylistProps) {
  if (!playlistId || playlistId.startsWith('TODO')) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className="text-center p-8">
          <p className="text-gray-500 font-medium">YouTube Playlist</p>
          <p className="text-sm text-gray-400 mt-2">
            TODO: Add YouTube playlist ID to display videos
          </p>
        </div>
      </div>
    );
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
