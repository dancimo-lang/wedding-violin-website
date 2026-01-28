'use client';

import { useEffect, useState } from 'react';

interface SoundCloudPlaylistProps {
  playlistUrl: string;
  height?: number;
}

export default function SoundCloudPlaylist({ playlistUrl, height = 350 }: SoundCloudPlaylistProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // Return placeholder with same dimensions to prevent layout shift
    return (
      <div className="w-full" style={{ height }}>
        <div className="bg-gray-100 rounded-lg animate-pulse h-full flex items-center justify-center">
          <span className="text-gray-400">Loading audio player...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <iframe
        width="100%"
        height={height}
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(playlistUrl)}&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&visual=true`}
        className="rounded-lg"
      />
    </div>
  );
}
