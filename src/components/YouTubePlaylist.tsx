'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

interface PlaylistProps {
  apiKey: string;
  playlistId: string;
  uniqueName: string;
}

const ReactYouTubePlaylist = dynamic<PlaylistProps>(
  () => import('@codesweetly/react-youtube-playlist').then((mod) => mod.default as unknown as ComponentType<PlaylistProps>),
  { 
    ssr: false,
    loading: () => (
      <div className="aspect-video bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-gray-400">Loading videos...</span>
      </div>
    ),
  }
);

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
      <ReactYouTubePlaylist
        apiKey={process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || ''}
        playlistId={playlistId}
        uniqueName="daniel-cimo-playlist"
      />
    </div>
  );
}
