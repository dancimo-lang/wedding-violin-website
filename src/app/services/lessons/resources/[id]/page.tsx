'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import Hero from '@/components/Hero';
import CTASection from '@/components/CTASection';
import { ArrowLeft, Download, Youtube, Music, FileText } from 'lucide-react';
import tunes from '@/data/tunes.json';

export default function TunePage() {
  const params = useParams();
  const id = params.id as string;
  const tune = tunes.tunes.find(t => t.id === id);

  if (!tune) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Tune Not Found</h1>
          <Link href="/services/lessons/resources" className="text-amber-600 hover:text-amber-700">
            Back to Tune Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero */}
      <Hero
        title={tune.title}
        subtitle={`${tune.type} • ${tune.key} • ${tune.difficulty}`}
        description={`${tune.description} Composed by ${tune.composer}.`}
        ctaText="Back to Library"
        ctaHref="/services/lessons/resources"
        posterSrc="/images/lessons-hero.jpg"
        size="large"
        overlay={false}
      />

      {/* Tune Info Bar */}
      <section className="py-8 bg-gray-50 border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-gray-700">Type:</span>
                <span className="text-gray-600">{tune.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">Key:</span>
                <span className="text-gray-600">{tune.key}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">Difficulty:</span>
                <span className="text-gray-600">{tune.difficulty}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-700">Composer:</span>
                <span className="text-gray-600">{tune.composer}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sheet Music Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-amber-600" />
                  <h2 className="text-2xl font-bold text-gray-900">Sheet Music</h2>
                </div>
                <a
                  href={tune.sheetMusicPath}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  <Download className="w-5 h-5" />
                  {tune.sheetMusicPath.endsWith('.pdf') ? 'Download PDF' : 'Download Image'}
                </a>
              </div>
              
              {/* Sheet Music Display */}
              <div className="p-8 bg-gray-50 min-h-[600px]">
                {tune.sheetMusicPath.endsWith('.pdf') ? (
                  <div className="w-full h-[800px]">
                    <object
                      data={tune.sheetMusicPath}
                      type="application/pdf"
                      className="w-full h-full"
                      title={`${tune.title} Sheet Music`}
                    >
                      <p className="text-center py-8">
                        <a href={tune.sheetMusicPath} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700">
                          Click here to view the PDF
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
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200 flex items-center gap-3">
                <Youtube className="w-6 h-6 text-red-600" />
                <h2 className="text-2xl font-bold text-gray-900">Video Tutorial</h2>
              </div>
              
              {/* YouTube Player */}
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                {tune.youtubeId ? (
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${tune.youtubeId}`}
                    title={`${tune.title} - Video Tutorial`}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                ) : (
                  <div className="text-center p-8">
                    <Youtube className="w-24 h-24 text-red-400 mx-auto mb-4" />
                    <p className="text-gray-400 text-lg mb-2">Video Coming Soon</p>
                    <p className="text-gray-500 text-sm">
                      Add YouTube video ID to tunes.json for: {tune.id}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tags Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2">
              {tune.tags.map(tag => (
                <span
                  key={tag}
                  className="px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Navigation */}
      <section className="py-8 border-t border-gray-200">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Link
              href="/services/lessons/resources"
              className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Tune Library
            </Link>
            <a
              href={tune.sheetMusicPath}
              download
              className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Download className="w-5 h-5" />
              Download PDF
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title="Want to Learn This Tune?"
        description="Schedule a lesson to get personalized instruction on this piece and others."
        buttonText="Book a Lesson"
        href="/booking?service=lessons"
        variant="primary"
      />
    </>
  );
}
