/**
 * Wedding clips for the "See us play" column beside the packages
 * on /services/weddings.
 *
 * Add real YouTube links to `weddingVideos`. Each entry accepts:
 * - `id`: a YouTube video ID, or a full URL (watch, youtu.be, embed, or shorts)
 * - `url` (optional): the full URL, useful when `id` is a bare video ID
 * - `title` (optional): accessible name for the embed
 * - `orientation` (optional): "portrait" for a Short (9:16) or "landscape"
 *   for a standard 16:9 video. A `/shorts/` URL is treated as portrait
 *   when orientation is omitted.
 *
 * Leave the list empty to show an invitation to the Instagram profile
 * in site.json instead of an embed. Do not add placeholder IDs.
 */
export type WeddingVideoOrientation = "portrait" | "landscape";

export type WeddingVideo = {
  id: string;
  url?: string;
  title?: string;
  orientation?: WeddingVideoOrientation;
};

export const weddingVideos: WeddingVideo[] = [
  {
    id: "nVncuZgtkh4",
    url: "https://www.youtube.com/shorts/nVncuZgtkh4",
    title: "Wedding violin clip",
    orientation: "portrait",
  },
];

export type WeddingVideoEmbed = {
  videoId: string;
  title: string;
  orientation: WeddingVideoOrientation;
};

function extractYouTubeId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? "";
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      const watchId = url.searchParams.get("v");
      if (watchId) return watchId;

      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts.findIndex(
        (part) =>
          part === "embed" || part === "shorts" || part === "live" || part === "v"
      );
      if (marker >= 0 && parts[marker + 1]) {
        return parts[marker + 1].split("?")[0];
      }
    }
  } catch {
    // A bare video ID is not a URL.
  }

  return trimmed.split(/[?&#]/)[0];
}

function isYouTubeShort(value: string | undefined): boolean {
  if (!value) return false;
  return /youtube\.com\/shorts\//i.test(value);
}

export function getWeddingVideoEmbeds(): WeddingVideoEmbed[] {
  const embeds: WeddingVideoEmbed[] = [];

  for (const entry of weddingVideos) {
    const idSource = entry.id?.trim() ?? "";
    const urlSource = entry.url?.trim() ?? "";
    const videoId = extractYouTubeId(idSource) || extractYouTubeId(urlSource);
    if (!videoId) continue;

    const orientation: WeddingVideoOrientation =
      entry.orientation ??
      (isYouTubeShort(urlSource) || isYouTubeShort(idSource)
        ? "portrait"
        : "landscape");

    embeds.push({
      videoId,
      title: entry.title?.trim() || "Wedding video",
      orientation,
    });
  }

  return embeds;
}
