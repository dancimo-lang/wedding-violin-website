interface HighlightVideoProps {
  src: string;
  poster: string;
  caption: string;
  label: string;
  width: number;
  height: number;
}

/** Self-hosted portrait clip with native controls; never autoplays. Dark/gold styling. */
export default function HighlightVideo({ src, poster, caption, label, width, height }: HighlightVideoProps) {
  return (
    <figure className="mx-auto w-full max-w-[420px]">
      <div className="rounded-xl border border-[#c9a961]/50 bg-black p-1.5 shadow-lg">
        <video
          className="block w-full h-auto rounded-lg bg-black"
          style={{ aspectRatio: `${width} / ${height}` }}
          controls
          playsInline
          preload="metadata"
          poster={poster}
          width={width}
          height={height}
          aria-label={label}
        >
          <source src={src} type="video/mp4" />
        </video>
      </div>
      <figcaption className="mt-3 text-center text-sm italic text-[#d9d1c1]">{caption}</figcaption>
    </figure>
  );
}
