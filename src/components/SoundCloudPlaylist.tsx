'use client';

import { useEffect, useRef, useState } from 'react';

interface SoundCloudPlaylistProps {
  /** SoundCloud API URL (e.g. https://api.soundcloud.com/playlists/<id>); the widget cannot resolve /sets/ permalinks reliably. */
  playlistUrl: string;
  height?: number;
}

/**
 * SoundCloud player that only loads its iframe when it nears the viewport
 * (or when the visitor taps the placeholder), so pages stay light.
 */
export default function SoundCloudPlaylist({ playlistUrl, height = 350 }: SoundCloudPlaylistProps) {
  const [load, setLoad] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (load) return;
    const node = ref.current;
    // Without IntersectionObserver the tap-to-load button still works.
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [load]);

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {load ? (
        <iframe
          title="SoundCloud audio player"
          width="100%"
          height={height}
          scrolling="no"
          frameBorder="no"
          allow="autoplay"
          loading="lazy"
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(playlistUrl)}&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&visual=true`}
          className="rounded-lg"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoad(true)}
          className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          Load audio player
        </button>
      )}
    </div>
  );
}
