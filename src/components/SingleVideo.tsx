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
  // Owner: a missing id, or one that still starts with TODO, is not shown.
  if (!videoId || videoId.startsWith('TODO')) {
    return null;
  }

  const portrait = orientation === 'portrait';

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
