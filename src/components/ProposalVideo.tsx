import SingleVideo from '@/components/SingleVideo';
import proposals from '@/data/proposals.json';

/**
 * PROPOSAL VIDEO SLOT. Renders nothing until `video.videoId` (a YouTube id)
 * is set in src/data/proposals.json.
 */
export default function ProposalVideo() {
  const { videoId, title, orientation } = proposals.video;
  if (!videoId) return null;
  return (
    <div className="max-w-md mx-auto mt-12">
      <SingleVideo
        videoId={videoId}
        title={title}
        orientation={orientation === 'portrait' ? 'portrait' : 'landscape'}
        showTitle={false}
      />
    </div>
  );
}
