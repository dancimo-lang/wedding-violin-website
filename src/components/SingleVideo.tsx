'use client';

interface SingleVideoProps {
  videoId: string;
  title?: string;
}

export default function SingleVideo({ videoId, title }: SingleVideoProps) {
  if (!videoId) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
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
