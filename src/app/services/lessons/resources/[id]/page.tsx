'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Hero from '@/components/Hero';
import CTASection from '@/components/CTASection';
import { ArrowLeft, Download, Youtube, Music, FileText } from 'lucide-react';
import { isPublishableCopy } from '@/lib/publicContent';

interface Tune {
  id: string;
  title: string;
  type: string;
  key: string;
  composer: string;
  difficulty: string;
  description: string;
  youtubeId: string;
  sheetMusicPath: string;
  tags: string[];
}

export default function TunePage() {
  const params = useParams();
  const id = params.id as string;
  const [tune, setTune] = useState<Tune | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTune() {
      try {
        const response = await fetch('/api/tunes');
        const data = await response.json();
        const foundTune = data.tunes?.find((t: Tune) => t.id === id);
        setTune(foundTune || null);
      } catch (error) {
        console.error('Error fetching tune:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTune();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4"></div>
          <p className="text-ink-body">Loading tune...</p>
        </div>
      </div>
    );
  }

  if (!tune) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-ink mb-4">Tune Not Found</h1>
          <Link href="/services/lessons/resources" className="text-gold-deep hover:text-gold-deeper">
            Back to Tune Library
          </Link>
        </div>
      </div>
    );
  }

  const hasSheetMusic = isPublishableCopy(tune.sheetMusicPath);
  const hasVideo = isPublishableCopy(tune.youtubeId);

  return (
    <>
      {/* Thin Banner */}
      <section className="bg-charcoal border-b border-gold/40 py-6">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-cream-bright mb-1">{tune.title}</h1>
                <p className="text-cream-muted">{tune.type} • {tune.key} • {tune.difficulty}</p>
              </div>
              <Link
                href="/services/lessons/resources"
                className="inline-flex items-center gap-2 bg-gold hover:bg-gold-hover text-charcoal px-6 py-3 rounded-full font-medium transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Library
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sheet Music and Video Section */}
      {(hasSheetMusic || hasVideo) && (
      <section className="py-8 bg-cream">
        <div className="container mx-auto px-4">
          <div className={`mx-auto grid grid-cols-1 gap-6 ${hasSheetMusic && hasVideo ? 'max-w-6xl lg:grid-cols-2' : 'max-w-3xl'}`}>
            {/* Sheet Music */}
            {hasSheetMusic && (
            <div className="bg-cream-card rounded-xl border border-cream-line overflow-hidden">
              <div className="p-4 border-b border-cream-line flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gold-deep" />
                  <h2 className="text-xl font-semibold text-ink">Sheet Music</h2>
                </div>
                <a
                  href={tune.sheetMusicPath}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gold hover:bg-gold-hover text-charcoal px-4 py-2 rounded-full font-medium transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
              <div className="p-4 bg-cream min-h-[500px]">
                {tune.sheetMusicPath.endsWith('.pdf') ? (
                  <div className="w-full h-[600px]">
                    <object
                      data={`/api/pdf/${tune.id}`}
                      type="application/pdf"
                      className="w-full h-full"
                      title={`${tune.title} Sheet Music`}
                    >
                      <p className="text-center py-8">
                        <a href={tune.sheetMusicPath} target="_blank" rel="noopener noreferrer" className="text-gold-deep hover:text-gold-deeper">
                          Click here to view the PDF in a new tab
                        </a>
                      </p>
                    </object>
                  </div>
                ) : (
                  <div className="w-full flex justify-center">
                    <img
                      src={tune.sheetMusicPath}
                      alt={`${tune.title} Sheet Music`}
                      className="max-w-full h-auto"
                    />
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Video */}
            {hasVideo && (
            <div className="bg-cream-card rounded-xl border border-cream-line overflow-hidden">
              <div className="p-4 border-b border-cream-line flex items-center gap-3">
                <Youtube className="w-5 h-5 text-gold-deep" />
                <h2 className="text-xl font-semibold text-ink">Video Tutorial</h2>
              </div>
              <div className="aspect-video bg-charcoal flex items-center justify-center">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${tune.youtubeId}?rel=0&modestbranding=1&playsinline=1`}
                  title={`${tune.title} - Video Tutorial`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            </div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Description Section */}
      <section className="py-8 bg-cream-card">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="bg-cream rounded-xl border border-cream-line p-6">
              <div className="flex items-center gap-4 mb-4">
                <Music className="w-6 h-6 text-gold-deep" />
                <h2 className="text-2xl font-semibold text-ink">About This Tune</h2>
              </div>
              <p className="text-ink-body text-lg leading-relaxed mb-6">
                {tune.description} Composed by {tune.composer}.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-ink-soft">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Type:</span>
                  <span>{tune.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Key:</span>
                  <span>{tune.key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Difficulty:</span>
                  <span>{tune.difficulty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Composer:</span>
                  <span>{tune.composer}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tags Section */}
      <section className="py-8 bg-cream">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap gap-2">
              {tune.tags.map(tag => (
                <span
                  key={tag}
                  className="px-4 py-2 bg-cream-card text-gold-deep border border-gold/40 rounded-full text-sm font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title="Want to Learn This Tune?"
        description="Schedule a lesson to get personalized instruction on this piece and others."
        buttonText="Book a Lesson"
        href="/booking?service=lessons#booking-form"
        variant="primary"
      />
    </>
  );
}
