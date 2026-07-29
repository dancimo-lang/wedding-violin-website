import { Metadata } from 'next';
import Hero from '@/components/Hero';
import CTASection from '@/components/CTASection';
import { FileText, Youtube, Download, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Lesson Resources - Violin Learning Materials',
  description: 'Access violin learning resources, sheet music, and instructional videos for students.',
  keywords: [
    'Violin Resources',
    'Violin Sheet Music',
    'Violin Tutorial Videos',
    'Violin Learning Materials',
  ],
};

export default function ResourcesPage() {
  return (
    <>
      {/* Hero */}
      <Hero
        title="Student Resources"
        subtitle="Learning Materials & Videos"
        description="Access sheet music, practice guides, and instructional videos to support your violin journey."
        ctaText="Back to Lessons"
        ctaHref="/services/lessons"
        posterSrc="/images/lessons-hero.jpg"
        size="large"
        overlay={false}
      />

      {/* Documents Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-6">
                <FileText className="w-8 h-8 text-amber-700" />
              </div>
              <h2 className="text-3xl font-bold text-black mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                Learning Documents
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Download sheet music, practice guides, and reference materials.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Document Card 1 */}
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-amber-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Beginner Scales Guide</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Essential scales for beginners with finger positions and practice tips.
                    </p>
                    <button className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 font-medium text-sm">
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Document Card 2 */}
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-amber-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Practice Log Template</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Track your daily practice sessions and progress with this printable log.
                    </p>
                    <button className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 font-medium text-sm">
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Document Card 3 */}
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-amber-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Finger Position Chart</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Visual guide for proper finger placement on the violin fingerboard.
                    </p>
                    <button className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 font-medium text-sm">
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Document Card 4 */}
              <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-6 h-6 text-amber-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2">Bowing Techniques</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      Comprehensive guide to different bowing styles and techniques.
                    </p>
                    <button className="inline-flex items-center gap-2 text-amber-700 hover:text-amber-800 font-medium text-sm">
                      <Download className="w-4 h-4" />
                      Download PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-6">
                <Youtube className="w-8 h-8 text-red-700" />
              </div>
              <h2 className="text-3xl font-bold text-black mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                Instructional Videos
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Watch step-by-step tutorials and demonstrations to enhance your learning.
              </p>
            </div>

            <div className="space-y-8">
              {/* Video Card 1 */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="aspect-video bg-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <Youtube className="w-16 h-16 text-red-600 mx-auto mb-4" />
                    <p className="text-gray-600">Video placeholder</p>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Proper Violin Hold</h3>
                  <p className="text-gray-600 text-sm">
                    Learn the correct way to hold your violin for optimal comfort and technique.
                  </p>
                </div>
              </div>

              {/* Video Card 2 */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="aspect-video bg-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <Youtube className="w-16 h-16 text-red-600 mx-auto mb-4" />
                    <p className="text-gray-600">Video placeholder</p>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Basic Bow Hold</h3>
                  <p className="text-gray-600 text-sm">
                    Master the fundamental bow hold technique for beautiful tone production.
                  </p>
                </div>
              </div>

              {/* Video Card 3 */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="aspect-video bg-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <Youtube className="w-16 h-16 text-red-600 mx-auto mb-4" />
                    <p className="text-gray-600">Video placeholder</p>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">First Scale: D Major</h3>
                  <p className="text-gray-600 text-sm">
                    Learn your first major scale with proper finger placement and intonation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CTASection
        title="Need More Help?"
        description="Schedule a lesson to get personalized guidance on using these resources."
        buttonText="Book a Lesson"
        href="/booking?service=lessons"
        variant="primary"
      />
    </>
  );
}
