'use client';

interface SingleVideoProps {
  videoId: string;
  title?: string;
}

export default function SingleVideo({ videoId, title }: SingleVideoProps) {
  // Owner: leave this empty until a real YouTube video id is available. Nothing is shown until then.
  if (!videoId || videoId.startsWith('TODO')) {
    return null;
  }

  return (
    <div className="rounded-lg overflow-hidden shadow-lg">
      {title && (
        <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
          {title}
        </h3>
      )}
      <div className="aspect-video">
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
