'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Hero from '@/components/Hero';
import CTASection from '@/components/CTASection';
import { AdminTuneLink } from '@/components/AdminTuneLink';
import { ResourceTipDialog, SupportLessonsLink, useResourceTipPrompt } from '@/components/ResourceTipPrompt';
import { Search, Music, FileText, Youtube } from 'lucide-react';
import { isPublishableCopy } from '@/lib/publicContent';
import { TIP_CANCELED, TIP_THANKS } from '@/lib/payments/resource-tip';
import type { Tune } from '@/lib/tune-types';

const LIBRARY_PATH = '/services/lessons/resources';

export default function LibraryView({ tip }: { tip: 'thanks' | 'canceled' | null }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [tunes, setTunes] = useState<Tune[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const prompt = useResourceTipPrompt(LIBRARY_PATH);

  useEffect(() => {
    let cancelled = false;
    async function fetchTunes() {
      try {
        const response = await fetch('/api/tunes');
        const data = await response.json();
        if (!cancelled) setTunes(data.tunes || []);
      } catch (error) {
        console.error('Error fetching tunes:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void fetchTunes();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTunes = useMemo(() => {
    return tunes.filter((tune) => {
      const tags = Array.isArray(tune.tags) ? tune.tags : [];
      const matchesSearch =
        tune.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tune.composer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = selectedType === 'All' || tune.type === selectedType;
      const matchesDifficulty = selectedDifficulty === 'All' || tune.difficulty === selectedDifficulty;
      return matchesSearch && matchesType && matchesDifficulty;
    });
  }, [searchQuery, selectedType, selectedDifficulty, tunes]);

  const types = ['All', ...Array.from(new Set(tunes.map((tune) => tune.type)))];
  const difficulties = ['All', ...Array.from(new Set(tunes.map((tune) => tune.difficulty)))];

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-gold"></div>
          <p className="text-ink-body">Loading tunes...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Hero
        title="Tune Library"
        subtitle="Violin Sheet Music & Videos"
        description="Browse our collection of violin tunes with sheet music and video tutorials."
        ctaText="Back to Lessons"
        ctaHref="/services/lessons"
        posterSrc="/images/lessons-hero.jpg"
        posterAlt="Daniel playing violin indoors beside a microphone"
        size="large"
        overlay={false}
      />

      <section className="bg-cream py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <AdminTuneLink />

            {tip ? (
              <p role="status" className="mb-6 rounded-xl border border-gold/50 bg-cream-card px-4 py-3 text-ink">
                {tip === 'thanks' ? TIP_THANKS : TIP_CANCELED}
              </p>
            ) : null}

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden />
              <input
                type="text"
                placeholder="Search tunes by name, composer, or tag..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-cream-line bg-cream-card py-4 pl-12 pr-4 text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="tune-type" className="mb-2 block text-sm font-medium text-ink">
                  Type
                </label>
                <select
                  id="tune-type"
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                  className="w-full rounded-lg border border-cream-line bg-cream-card px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  {types.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[200px] flex-1">
                <label htmlFor="tune-difficulty" className="mb-2 block text-sm font-medium text-ink">
                  Difficulty
                </label>
                <select
                  id="tune-difficulty"
                  value={selectedDifficulty}
                  onChange={(event) => setSelectedDifficulty(event.target.value)}
                  className="w-full rounded-lg border border-cream-line bg-cream-card px-4 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-gold"
                >
                  {difficulties.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      {difficulty}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink-body">
                {filteredTunes.length} tune{filteredTunes.length !== 1 ? 's' : ''} found
              </p>
              <SupportLessonsLink prompt={prompt} />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-cream py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            {filteredTunes.length === 0 ? (
              <div className="py-12 text-center">
                <Music className="mx-auto mb-4 h-16 w-16 text-gray-300" aria-hidden />
                <p className="text-lg text-ink-soft">No tunes found matching your search.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTunes.map((tune) => {
                  const tags = Array.isArray(tune.tags) ? tune.tags : [];
                  return (
                    <Link
                      key={tune.id}
                      href={`/services/lessons/resources/${tune.id}`}
                      className="block rounded-xl border border-cream-line bg-cream-card p-6 transition-colors hover:border-gold"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-semibold text-ink">{tune.title}</h3>
                            <span className="rounded-full border border-gold/40 bg-cream px-3 py-1 text-xs font-medium text-gold-deep">
                              {tune.type}
                            </span>
                            <span className="rounded-full bg-charcoal px-3 py-1 text-xs font-medium text-cream-bright">
                              {tune.difficulty}
                            </span>
                          </div>
                          <p className="mb-2 text-sm text-ink-body">{tune.composer}</p>
                          <p className="line-clamp-2 text-sm text-ink-soft">{tune.description}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="text-xs text-ink-soft">{tune.key}</span>
                            <div className="flex flex-wrap gap-2">
                              {tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="text-xs text-ink-soft">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPublishableCopy(tune.sheetMusicPath) ? (
                            <FileText className="h-5 w-5 text-gold-deep" aria-label="Sheet music" />
                          ) : null}
                          {isPublishableCopy(tune.youtubeId) ? (
                            <Youtube className="h-5 w-5 text-red-600" aria-label="Video" />
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <CTASection
        title="Need Help Learning These Tunes?"
        description="Schedule a lesson to get personalized guidance on any tune in our library."
        buttonText="Book a Lesson"
        href="/booking?service=lessons#booking-form"
        variant="primary"
      />
      <ResourceTipDialog prompt={prompt} />
    </>
  );
}
