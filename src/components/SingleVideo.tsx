'use client';

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

export default function SingleVideo({
  videoId,
  title,
  orientation = 'landscape',
  showTitle = true,
}: SingleVideoProps) {
  const portrait = orientation === 'portrait';

  if (!videoId) {
    return (
      <div
        className={`bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 ${
          portrait ? 'aspect-[9/16] w-full max-w-[280px] mx-auto' : 'aspect-video'
        }`}
      >
        <div className="text-center p-8">
          <p className="text-gray-500 font-medium">YouTube Video</p>
          <p className="text-sm text-gray-400 mt-2">
            TODO: Add YouTube video ID to display video
          </p>
        </div>
      </div>
    );
  }

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
      <div className={portrait ? 'aspect-[9/16]' : 'aspect-video'}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
          title={title || "YouTube video player"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
