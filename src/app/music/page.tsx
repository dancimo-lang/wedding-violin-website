'use client';

import Hero from '@/components/Hero';
import YouTubePlaylist from '@/components/YouTubePlaylist';
import SoundCloudPlaylist from '@/components/SoundCloudPlaylist';
import CTASection from '@/components/CTASection';
import GoldDivider from '@/components/GoldDivider';
import music from '@/data/music.json';
import { isPublishableCopy } from '@/lib/publicContent';

export default function MusicPage() {
  const scrollToVideo = () => {
    document.getElementById('video-player')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToAudio = () => {
    document.getElementById('audio-player')?.scrollIntoView({ behavior: 'smooth' });
  };

  const showVideo = isPublishableCopy(music.youtube.playlistId);
  const publishedAudioSamples = music.audioSamples.samples.filter((sample) =>
    isPublishableCopy(sample),
  );

  return (
    <>
      {/* Hero */}
      <Hero
        title={music.hero.title}
        subtitle={music.hero.subtitle}
        description={music.hero.description}
        ctaText={showVideo ? 'Watch' : undefined}
        ctaOnClick={showVideo ? scrollToVideo : undefined}
        secondaryCtaText="Listen"
        secondaryCtaOnClick={scrollToAudio}
        splitLayout={true}
        leftSideImage={undefined}
        rightSideImage="/images/music-hero.jpg"
        rightSideImageAlt="Close-up of a hand on a violin fingerboard in warm light"
        size="full"
      />

      {/* YouTube Video Section */}
      {showVideo && (
      <section id="video-player" className="py-20 md:py-24 bg-charcoal">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <GoldDivider />
            <h2 className="text-3xl md:text-4xl font-semibold text-cream-bright mb-8 text-center">
 Featured Performances
            </h2>
            <YouTubePlaylist playlistId={music.youtube.playlistId} />
            <p className="text-center text-sm text-cream-dim mt-4">
              Experience the beauty and emotion of live violin performances
            </p>
          </div>
        </div>
      </section>
      )}

      {/* Repertoire Section */}
      <section className="py-20 md:py-24 bg-cream">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <GoldDivider />
            <h2 className="text-3xl md:text-4xl font-semibold text-ink mb-4">
              {music.repertoire.title}
            </h2>
            <p className="text-ink-body max-w-2xl mx-auto">
              From classical masterpieces to contemporary favorites, I offer a diverse repertoire tailored to your event.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-7xl mx-auto">
            {music.repertoire.categories.map((category, index) => (
              <div
                key={index}
                className="bg-cream-card p-6 rounded-xl border border-cream-line"
              >
                <h3 className="text-lg font-semibold text-ink mb-2">
                  {category.name}
                </h3>
                <p className="text-sm text-ink-soft mb-4">
                  {category.description}
                </p>
                <ul className="space-y-1">
                  {category.examples.map((example, i) => (
                    <li key={i} className="text-sm text-ink-body flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gold rounded-full" />
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Audio Samples Section */}
      <section id="audio-player" className="py-20 md:py-24 bg-charcoal">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <GoldDivider />
            <h2 className="text-3xl md:text-4xl font-semibold text-cream-bright mb-8 text-center">
              {music.audioSamples.title}
            </h2>
            <SoundCloudPlaylist playlistUrl={music.soundcloud.embedUrl} />
            {publishedAudioSamples.length > 0 && (
              <ul className="mt-8 space-y-2">
                {publishedAudioSamples.map((sample) => (
                  <li key={sample} className="text-cream-muted text-center">
                    {sample}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-center text-sm text-cream-dim mt-4">
              {music.soundcloud.note}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title={music.cta.title}
        description={music.cta.description}
        buttonText={music.cta.buttonText}
        href={music.cta.href}
        variant="primary"
      />
    </>
  );
}
