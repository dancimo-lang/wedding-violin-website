'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Hero from '@/components/Hero';
import CTASection from '@/components/CTASection';
import { Search, Music, FileText, Youtube, BookOpen } from 'lucide-react';
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

export default function ResourcesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [tunes, setTunes] = useState<Tune[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTunes() {
      try {
        const response = await fetch('/api/tunes');
        const data = await response.json();
        setTunes(data.tunes || []);
      } catch (error) {
        console.error('Error fetching tunes:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTunes();
  }, []);

  const filteredTunes = useMemo(() => {
    return tunes.filter(tune => {
      const matchesSearch = tune.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           tune.composer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           tune.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = selectedType === 'All' || tune.type === selectedType;
      const matchesDifficulty = selectedDifficulty === 'All' || tune.difficulty === selectedDifficulty;
      return matchesSearch && matchesType && matchesDifficulty;
    });
  }, [searchQuery, selectedType, selectedDifficulty, tunes]);

  const types = ['All', ...Array.from(new Set(tunes.map(t => t.type)))];
  const difficulties = ['All', ...Array.from(new Set(tunes.map(t => t.difficulty)))];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4"></div>
          <p className="text-ink-body">Loading tunes...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
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

      {/* Search and Filter Section */}
      <section className="py-12 bg-cream">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Admin Link */}
            <div className="mb-6 flex justify-end">
              <Link
                href="/admin/add-tune"
                className="inline-flex items-center gap-2 bg-gold hover:bg-gold-hover text-charcoal px-4 py-2 rounded-full font-medium transition-colors text-sm"
              >
                <BookOpen className="w-4 h-4" />
                Add New Tune
              </Link>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tunes by name, composer, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-cream-line bg-cream-card focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent text-ink"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-ink mb-2">Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-cream-line bg-cream-card focus:outline-none focus:ring-2 focus:ring-gold text-ink"
                >
                  {types.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-ink mb-2">Difficulty</label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-cream-line bg-cream-card focus:outline-none focus:ring-2 focus:ring-gold text-ink"
                >
                  {difficulties.map(diff => (
                    <option key={diff} value={diff}>{diff}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Count */}
            <p className="mt-4 text-ink-body text-sm">
              {filteredTunes.length} tune{filteredTunes.length !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>
      </section>

      {/* Tunes List */}
      <section className="py-12 bg-cream">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {filteredTunes.length === 0 ? (
              <div className="text-center py-12">
                <Music className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-ink-soft text-lg">No tunes found matching your search.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTunes.map((tune) => (
                  <Link
                    key={tune.id}
                    href={`/services/lessons/resources/${tune.id}`}
                    className="block bg-cream-card p-6 rounded-xl border border-cream-line hover:border-gold transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-ink">{tune.title}</h3>
                          <span className="px-3 py-1 bg-cream text-gold-deep text-xs font-medium rounded-full border border-gold/40">
                            {tune.type}
                          </span>
                          <span className="px-3 py-1 bg-charcoal text-cream-bright text-xs font-medium rounded-full">
                            {tune.difficulty}
                          </span>
                        </div>
                        <p className="text-ink-body text-sm mb-2">{tune.composer}</p>
                        <p className="text-ink-soft text-sm line-clamp-2">{tune.description}</p>
                        <div className="flex items-center gap-4 mt-3">
                          <span className="text-xs text-ink-soft">{tune.key}</span>
                          <div className="flex gap-2">
                            {tune.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-xs text-ink-soft">#{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {isPublishableCopy(tune.sheetMusicPath) && (
                          <FileText className="w-5 h-5 text-gold-deep" />
                        )}
                        {isPublishableCopy(tune.youtubeId) && (
                          <Youtube className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title="Need Help Learning These Tunes?"
        description="Schedule a lesson to get personalized guidance on any tune in our library."
        buttonText="Book a Lesson"
        href="/booking?service=lessons#booking-form"
        variant="primary"
      />
    </>
  );
}
