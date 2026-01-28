import { Metadata } from 'next';
import Hero from '@/components/Hero';
import YouTubePlaylist from '@/components/YouTubePlaylist';
import SingleVideo from '@/components/SingleVideo';
import SoundCloudPlaylist from '@/components/SoundCloudPlaylist';
import CTASection from '@/components/CTASection';
import music from '@/data/music.json';

export const metadata: Metadata = {
  title: 'Music & Video',
  description: 'Listen to Daniel Cimo perform. Watch videos and explore repertoire for weddings, events, and more.',
  keywords: ['Violin Music Samples', 'Wedding Violin Videos', 'Central Coast Violinist Performances'],
};

export default function MusicPage() {
  return (
    <>
      {/* Hero */}
      <Hero
        title={music.hero.title}
        subtitle={music.hero.subtitle}
        description={music.hero.description}
        posterSrc="/images/music-hero.jpg"
        size="medium"
      />

      {/* YouTube Video Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative">
              Featured Performance
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-amber-500 to-blue-500 rounded-full"></span>
            </h2>
            <SingleVideo 
              videoId="V-PTvpsTY1s" 
            />
            <p className="text-center text-sm text-gray-400 mt-4">
              Experience the beauty and emotion of live violin performance
            </p>
          </div>
        </div>
      </section>

      {/* Repertoire Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-black mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative">
              {music.repertoire.title}
              <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-blue-500 rounded-full"></span>
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              From classical masterpieces to contemporary favorites, I offer a diverse repertoire tailored to your event.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-7xl mx-auto">
            {music.repertoire.categories.map((category, index) => (
              <div
                key={index}
                className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {category.name}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {category.description}
                </p>
                <ul className="space-y-1">
                  {category.examples.map((example, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
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
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-black mb-8 text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] relative">
              {music.audioSamples.title}
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-amber-500 to-blue-500 rounded-full"></span>
            </h2>
            <SoundCloudPlaylist playlistUrl={music.soundcloud.playlistUrl} />
            <p className="text-center text-sm text-gray-400 mt-4">
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
