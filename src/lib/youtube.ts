const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{12,}$/;

export type YoutubeEmbed = {
  src: string;
  videoId: string;
  start: number;
  list: string;
};

/**
 * Turn a stored YouTube value into an embed URL.
 * Accepts a bare id, an id with extra params (`id&t=90s`), and the usual
 * watch, youtu.be, shorts, live, and embed links. Share params such as `si`
 * are dropped. A start time becomes `start` in seconds.
 */
export function youtubeEmbed(value: string | null | undefined): YoutubeEmbed | null {
  const parsed = parseYoutube(value);
  if (!parsed) return null;
  const params = new URLSearchParams();
  params.set('rel', '0');
  params.set('modestbranding', '1');
  params.set('playsinline', '1');
  if (parsed.start > 0) params.set('start', String(parsed.start));
  if (parsed.list) params.set('list', parsed.list);
  const path = parsed.videoId || 'videoseries';
  return {
    src: `https://www.youtube.com/embed/${path}?${params.toString()}`,
    videoId: parsed.videoId,
    start: parsed.start,
    list: parsed.list,
  };
}

function parseYoutube(value: string | null | undefined): { videoId: string; start: number; list: string } | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed === '#') return null;

  const fromUrl = parseUrl(trimmed);
  if (fromUrl) return fromUrl;

  const glued = /^([A-Za-z0-9_-]{11})(?:[?&]([\s\S]+))?$/.exec(trimmed);
  if (!glued) return null;
  return finish(glued[1], new URLSearchParams(glued[2] ?? ''));
}

function parseUrl(value: string): { videoId: string; start: number; list: string } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const youtube =
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com';
  if (!youtube) return null;

  let videoId = '';
  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? '';
  } else {
    videoId = url.searchParams.get('v') ?? '';
    if (!videoId) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' && parts[1] === 'videoseries') {
        videoId = '';
      } else {
        const marker = parts.findIndex((part) => part === 'embed' || part === 'shorts' || part === 'live' || part === 'v');
        if (marker >= 0) videoId = parts[marker + 1] ?? '';
      }
    }
  }
  return finish(videoId.split(/[?&#]/)[0] ?? '', url.searchParams);
}

function finish(videoId: string, params: URLSearchParams): { videoId: string; start: number; list: string } | null {
  const id = VIDEO_ID.test(videoId) ? videoId : '';
  const listRaw = params.get('list') ?? '';
  const list = PLAYLIST_ID.test(listRaw) ? listRaw : '';
  const start = parseStart(params.get('start') || params.get('t') || '');
  if (!id && !list) return null;
  return { videoId: id, start, list };
}

function parseStart(value: string): number {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return 0;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(trimmed);
  if (!match || (!match[1] && !match[2] && !match[3])) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}
