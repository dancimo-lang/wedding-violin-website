import SingleVideo from '@/components/SingleVideo';
import HighlightVideo from '@/components/HighlightVideo';
import proposals from '@/data/proposals.json';

/**
 * PROPOSAL VIDEO SLOT, set in src/data/proposals.json.
 * A self-hosted mp4 (src + poster) wins; else a YouTube videoId; else nothing renders.
 */
export default function ProposalVideo() {
  const { src, poster, width, height, videoId, title, caption, orientation } = proposals.video;
  if (src) {
    return (
      <section aria-label="Proposal video" className="py-14 md:py-16 bg-[#14171f]">
        <div className="container mx-auto px-4">
          <HighlightVideo
            src={src}
            poster={poster}
            width={width}
            height={height}
            caption={caption}
            label="Video: a real proposal with live violin"
          />
        </div>
      </section>
    );
  }
  if (!videoId) return null;
  return (
    <section aria-label="Proposal video" className="py-14 md:py-16 bg-[#14171f]">
      <div className="max-w-md mx-auto px-4">
        <SingleVideo videoId={videoId} title={title} orientation={orientation === 'portrait' ? 'portrait' : 'landscape'} showTitle={false} />
      </div>
    </section>
  );
}
