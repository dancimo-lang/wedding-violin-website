'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import CTASection from '@/components/CTASection';
import { downloadName, ResourceTipDialog, SupportLessonsLink, useResourceTipPrompt } from '@/components/ResourceTipPrompt';
import { goldButtonClass, outlineButtonClass, quietLinkClass } from '@/components/public-button';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import { isPublishableCopy } from '@/lib/publicContent';
import { TIP_CANCELED, TIP_THANKS } from '@/lib/payments/resource-tip';
import { downloadExtension, isMusicXmlExtension } from '@/lib/tune-files';
import { youtubeEmbed } from '@/lib/youtube';
import type { Tune } from '@/lib/tune-types';

const SheetMusicViewer = dynamic(() => import('@/components/SheetMusicViewer'), {
  ssr: false,
  loading: () => <p className="py-16 text-center text-ink-body">Loading sheet music…</p>,
});

const InteractiveSheetPlayer = dynamic(() => import('@/components/InteractiveSheetPlayer'), {
  ssr: false,
  loading: () => <p className="py-16 text-center text-ink-body">Loading score…</p>,
});

const navClass =
  'flex min-h-11 w-full flex-col justify-center rounded-xl border border-cream-line bg-cream-card px-4 py-3 transition-colors hover:border-gold';

export default function TuneView({ id, tip }: { id: string; tip: 'thanks' | 'canceled' | null }) {
  const [tunes, setTunes] = useState<Tune[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sheetMode, setSheetMode] = useState<'play' | 'pdf'>('play');
  const [playerFailed, setPlayerFailed] = useState(false);
  const prompt = useResourceTipPrompt(`/services/lessons/resources/${id}`);

  useEffect(() => {
    let cancelled = false;
    async function fetchTunes() {
      try {
        const response = await fetch('/api/tunes');
        const data = await response.json();
        if (!cancelled) setTunes(Array.isArray(data.tunes) ? data.tunes : []);
      } catch (error) {
        console.error('Error fetching tune:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    setSheetMode('play');
    setPlayerFailed(false);
    void fetchTunes();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-gold"></div>
          <p className="text-ink-body">Loading tune...</p>
        </div>
      </div>
    );
  }

  const index = tunes.findIndex((item) => item.id === id);
  const tune = index >= 0 ? tunes[index] : null;
  if (!tune) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-semibold text-ink">Tune Not Found</h1>
          <Link href="/services/lessons/resources" className="text-gold-deep hover:text-gold-deeper">
            Back to Tune Library
          </Link>
        </div>
      </div>
    );
  }

  const previous = index > 0 ? tunes[index - 1] : null;
  const next = index < tunes.length - 1 ? tunes[index + 1] : null;
  const tags = Array.isArray(tune.tags) ? tune.tags : [];
  const video = youtubeEmbed(tune.youtubeId);
  const hasVideo = Boolean(video);
  const hasSheetMusic = isPublishableCopy(tune.sheetMusicPath);
  const sheetIsPdf = hasSheetMusic && downloadExtension(tune.sheetMusicPath) === '.pdf';
  const hasScore = isPublishableCopy(tune.museScorePath);
  const hasMusicXml = hasScore && isMusicXmlExtension(downloadExtension(tune.museScorePath || ''));
  const showPlayAlong = hasMusicXml && !playerFailed;
  const showSheet = hasSheetMusic || showPlayAlong;
  const showPracticeTips = isPublishableCopy(tune.practiceTips);
  const sideBySide = hasVideo && showSheet;

  return (
    <>
      <section className="border-b border-gold/40 bg-charcoal py-6">
        <div className="container mx-auto px-4">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-semibold text-cream-bright">{tune.title}</h1>
            <Link href="/services/lessons/resources" className={`${goldButtonClass} px-6`}>
              <ArrowLeft className="h-5 w-5" aria-hidden />
              Back to Library
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-cream py-6 sm:py-8">
        <div className="container mx-auto px-4">
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
              {tip ? (
                <p role="status" className="rounded-xl border border-gold/50 bg-cream-card px-4 py-3 text-ink">
                  {tip === 'thanks' ? TIP_THANKS : TIP_CANCELED}
                </p>
              ) : null}

              <article className="rounded-xl border border-cream-line bg-cream-card p-5 sm:p-6">
                {isPublishableCopy(tune.description) ? (
                  <p className="text-base leading-relaxed text-ink-body sm:text-lg">{tune.description}</p>
                ) : null}
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-ink-soft">Composer</dt>
                    <dd className="font-medium text-ink">{tune.composer}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">Key</dt>
                    <dd className="font-medium text-ink">{tune.key}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">Type</dt>
                    <dd className="font-medium text-ink">{tune.type}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">Difficulty</dt>
                    <dd className="font-medium text-ink">{tune.difficulty}</dd>
                  </div>
                </dl>
                {tags.length > 0 ? (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-gold/40 bg-cream px-3 py-1 text-sm font-medium text-gold-deep"
                      >
                        #{tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {showPracticeTips ? (
                  <div className="mt-5 border-t border-cream-line pt-4">
                    <h2 className="text-lg font-semibold text-ink">Practice tips</h2>
                    <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink-body">{tune.practiceTips}</p>
                  </div>
                ) : null}
              </article>

              <SupportLessonsLink prompt={prompt} />
            </div>

            {hasVideo || showSheet ? (
              <div
                className={
                  sideBySide
                    ? 'grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)]'
                    : hasVideo
                      ? 'mx-auto w-full max-w-[900px]'
                      : 'w-full'
                }
              >
                {hasVideo ? (
                  <div className={sideBySide ? 'min-w-0 lg:sticky lg:top-[calc(var(--header-height)+1rem)]' : undefined}>
                    <div className="overflow-hidden rounded-xl border border-cream-line bg-cream-card">
                      <h2 className="border-b border-cream-line px-4 py-3 text-lg font-semibold text-ink">Video</h2>
                      <div className="aspect-video bg-charcoal">
                        <iframe
                          className="h-full w-full"
                          src={video?.src}
                          title={`${tune.title} video`}
                          referrerPolicy="strict-origin-when-cross-origin"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {showSheet ? (
                  <div className={sideBySide ? 'min-w-0' : undefined}>
                    <div className="overflow-hidden rounded-xl border border-cream-line bg-cream-card">
                      <div className="flex flex-col gap-3 border-b border-cream-line p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-gold-deep" aria-hidden />
                          <h2 className="text-xl font-semibold text-ink">Sheet Music</h2>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          {sheetIsPdf ? (
                            <button
                              type="button"
                              className={`${goldButtonClass} w-full sm:w-auto`}
                              onClick={() =>
                                prompt.requestDownload({
                                  href: `/api/pdf/${tune.id}`,
                                  filename: downloadName(tune.id, tune.sheetMusicPath, '.pdf'),
                                })
                              }
                            >
                              <Download className="h-4 w-4" aria-hidden />
                              Download PDF
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={`${goldButtonClass} w-full sm:w-auto`}
                              onClick={() =>
                                prompt.requestDownload({
                                  href: tune.sheetMusicPath,
                                  filename: downloadName(tune.id, tune.sheetMusicPath, ''),
                                })
                              }
                            >
                              <Download className="h-4 w-4" aria-hidden />
                              Download sheet music
                            </button>
                          )}
                          {hasScore ? (
                            <button
                              type="button"
                              className={`${goldButtonClass} w-full sm:w-auto`}
                              onClick={() =>
                                prompt.requestDownload({
                                  href: tune.museScorePath || '',
                                  filename: downloadName(tune.id, tune.museScorePath || '', '.mscz'),
                                })
                              }
                            >
                              <Download className="h-4 w-4" aria-hidden />
                              Download MuseScore file
                            </button>
                          ) : null}
                          {sheetIsPdf ? (
                            <a
                              href={`/api/pdf/${tune.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${quietLinkClass} justify-center`}
                            >
                              Open PDF
                            </a>
                          ) : null}
                        </div>
                      </div>
                      <div className="p-3 sm:p-4">
                        {showPlayAlong && sheetIsPdf ? (
                          <div role="tablist" aria-label="Sheet music view" className="mb-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              role="tab"
                              aria-selected={sheetMode === 'play'}
                              className={sheetMode === 'play' ? goldButtonClass : outlineButtonClass}
                              onClick={() => setSheetMode('play')}
                            >
                              Play along
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={sheetMode === 'pdf'}
                              className={sheetMode === 'pdf' ? goldButtonClass : outlineButtonClass}
                              onClick={() => setSheetMode('pdf')}
                            >
                              PDF
                            </button>
                          </div>
                        ) : null}
                        {showPlayAlong && sheetMode === 'play' ? (
                          <InteractiveSheetPlayer
                            scoreUrl={tune.museScorePath || ''}
                            title={tune.title}
                            onUnavailable={() => setPlayerFailed(true)}
                          />
                        ) : sheetIsPdf ? (
                          <SheetMusicViewer key={tune.id} fileUrl={`/api/pdf/${tune.id}`} title={tune.title} />
                        ) : hasSheetMusic ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={tune.sheetMusicPath} alt={`${tune.title} sheet music`} className="mx-auto h-auto w-full" />
                          </>
                        ) : (
                          <p className="py-8 text-center text-ink-body">The interactive score could not be shown.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mx-auto grid w-full max-w-[900px] gap-3 sm:grid-cols-2">
              {previous ? (
                <Link href={`/services/lessons/resources/${previous.id}`} className={navClass}>
                  <span className="text-xs uppercase tracking-wide text-ink-soft">Previous tune</span>
                  <span className="text-base font-semibold text-ink">{previous.title}</span>
                </Link>
              ) : (
                <span className="hidden sm:block" />
              )}
              {next ? (
                <Link href={`/services/lessons/resources/${next.id}`} className={`${navClass} sm:items-end sm:text-right`}>
                  <span className="text-xs uppercase tracking-wide text-ink-soft">Next tune</span>
                  <span className="text-base font-semibold text-ink">{next.title}</span>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title="Want to Learn This Tune?"
        description="Schedule a lesson to get personalized instruction on this piece and others."
        buttonText="Book a Lesson"
        href="/booking?service=lessons#booking-form"
        variant="primary"
      />
      <ResourceTipDialog prompt={prompt} />
    </>
  );
}
