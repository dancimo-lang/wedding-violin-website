'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Hero from '@/components/Hero';
import CTASection from '@/components/CTASection';
import { ArrowLeft, Download, Youtube, Music, FileText } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tune...</p>
        </div>
      </div>
    );
  }

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
      {/* Thin Banner */}
      <section className="bg-gradient-to-r from-amber-600 to-amber-700 py-6">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">{tune.title}</h1>
                <p className="text-amber-100">{tune.type} • {tune.key} • {tune.difficulty}</p>
              </div>
              <Link
                href="/services/lessons/resources"
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-amber-700 px-6 py-3 rounded-lg font-medium transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Library
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sheet Music and Video Section */}
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sheet Music */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-amber-600" />
                  <h2 className="text-xl font-bold text-gray-900">Sheet Music</h2>
                </div>
                <a
                  href={tune.sheetMusicPath}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
              <div className="p-4 bg-gray-50 min-h-[500px]">
                {tune.sheetMusicPath.endsWith('.pdf') ? (
                  <div className="w-full h-[600px]">
                    <object
                      data={`/api/pdf/${tune.id}`}
                      type="application/pdf"
                      className="w-full h-full"
                      title={`${tune.title} Sheet Music`}
                    >
                      <p className="text-center py-8">
                        <a href={tune.sheetMusicPath} target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:text-amber-700">
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

            {/* Video */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                <Youtube className="w-5 h-5 text-red-600" />
                <h2 className="text-xl font-bold text-gray-900">Video Tutorial</h2>
              </div>
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                {tune.youtubeId ? (
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

      {/* Description Section */}
      <section className="py-8 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center gap-4 mb-4">
                <Music className="w-6 h-6 text-amber-600" />
                <h2 className="text-2xl font-bold text-gray-900">About This Tune</h2>
              </div>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                {tune.description} Composed by {tune.composer}.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
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
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
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
