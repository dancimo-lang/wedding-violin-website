import Link from 'next/link';
import Image from 'next/image';
import { Music } from 'lucide-react';

interface HeroProps {
  title: string;
  subtitle?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  secondaryCtaOnClick?: () => void;
  tertiaryCtaText?: string;
  tertiaryCtaOnClick?: () => void;
  videoSrc?: string;
  posterSrc?: string;
  backgroundPosition?: string;
  overlay?: boolean;
  size?: 'full' | 'large' | 'medium';
  splitLayout?: boolean;
  leftSideImage?: string;
  rightSideImage?: string | null;
}

export default function Hero({
  title,
  subtitle,
  description,
  ctaText,
  ctaHref = '/booking',
  ctaOnClick,
  secondaryCtaText,
  secondaryCtaHref,
  secondaryCtaOnClick,
  tertiaryCtaText,
  tertiaryCtaOnClick,
  videoSrc,
  posterSrc,
  backgroundPosition = 'center',
  overlay = true,
  size = 'large',
  splitLayout = false,
  leftSideImage,
  rightSideImage,
}: HeroProps) {
  const sizeClasses = {
    full: 'min-h-screen',
    large: 'min-h-[80vh]',
    medium: 'min-h-[60vh]',
  };

  return (
    <section className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
      {/* Video Background */}
      {videoSrc && (
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={posterSrc}
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {/* Poster Fallback (when no video) */}
      {!videoSrc && !splitLayout && (
        <div className="absolute inset-0">
          <Image
            src={posterSrc || '/images/hero-poster.jpg'}
            alt="Hero Background"
            fill
            className="object-cover"
            style={{ objectPosition: backgroundPosition }}
            priority
          />
        </div>
      )}

      {/* Gradient Overlay */}
      {overlay && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50" />
      )}

      {/* Split Layout Content */}
      {splitLayout ? (
        <div className="relative z-10 container mx-auto px-4 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-full">
            {/* Left Side */}
            <div className="flex flex-col justify-center items-center text-white p-8 lg:p-12">
              {subtitle && (
                <p className="text-white/90 font-medium tracking-wide uppercase mb-6 text-sm md:text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  {subtitle}
                </p>
              )}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-8 leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] text-center">
                {title}
              </h1>
              {description && (
                <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] text-center">
                  {description}
                </p>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {ctaText && (
                  ctaOnClick ? (
                    <button
                      onClick={ctaOnClick}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-[0_0_30px_rgba(0,174,239,0.6)] hover:shadow-[0_0_40px_rgba(0,174,239,0.8)]"
                    >
                      {ctaText}
                    </button>
                  ) : (
                    <Link
                      href={ctaHref}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-[0_0_30px_rgba(0,174,239,0.6)] hover:shadow-[0_0_40px_rgba(0,174,239,0.8)]"
                    >
                      {ctaText}
                    </Link>
                  )
                )}
                {secondaryCtaText && (
                  secondaryCtaOnClick ? (
                    <button
                      onClick={secondaryCtaOnClick}
                      className="border-2 border-blue-300 text-blue-100 hover:bg-blue-500 hover:text-white hover:border-blue-500 px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-[0_0_20px_rgba(0,174,239,0.4)] hover:shadow-[0_0_30px_rgba(0,174,239,0.7)]"
                    >
                      {secondaryCtaText}
                    </button>
                  ) : secondaryCtaHref && (
                    <Link
                      href={secondaryCtaHref}
                      className="border-2 border-blue-300 text-blue-100 hover:bg-blue-500 hover:text-white hover:border-blue-500 px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-[0_0_20px_rgba(0,174,239,0.4)] hover:shadow-[0_0_30px_rgba(0,174,239,0.7)]"
                    >
                      {secondaryCtaText}
                    </Link>
                  )
                )}
                {tertiaryCtaText && tertiaryCtaOnClick && (
                  <button
                    onClick={tertiaryCtaOnClick}
                    className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-4 rounded-full font-semibold text-lg transition-all shadow-[0_0_20px_rgba(251,191,36,0.6)] hover:shadow-[0_0_30px_rgba(251,191,36,0.8)]"
                  >
                    <Music className="w-5 h-5" />
                    {tertiaryCtaText}
                  </button>
                )}
              </div>
            </div>

            {/* Right Side */}
            <div className="relative h-full">
              {rightSideImage && (
                <Image
                  src={rightSideImage}
                  alt="Daniel Cimo Portrait"
                  width={800}
                  height={1200}
                  className="w-full h-full object-cover"
                  priority
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Original Layout */
        <div className={`relative z-10 container mx-auto px-4 text-center ${size === 'medium' ? 'mt-[20vh]' : size === 'large' ? '-mt-[20vh]' : ''}`}>
          <div className="max-w-4xl mx-auto">
            {subtitle && (
              <p className="text-white/90 font-medium tracking-wide uppercase mb-4 text-sm md:text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {subtitle}
              </p>
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
              {title}
            </h1>
            {description && (
              <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] backdrop-blur-sm bg-black/10 px-6 py-3 rounded-2xl">
                {description}
              </p>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {ctaText && (
                <Link
                  href={ctaHref}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-[0_0_30px_rgba(0,174,239,0.6)] hover:shadow-[0_0_40px_rgba(0,174,239,0.8)]"
                >
                  {ctaText}
                </Link>
              )}
              {secondaryCtaText && (
                secondaryCtaOnClick ? (
                  <button
                    onClick={secondaryCtaOnClick}
                    className="border-2 border-blue-300 text-blue-100 hover:bg-blue-500 hover:text-white hover:border-blue-500 px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-[0_0_20px_rgba(0,174,239,0.4)] hover:shadow-[0_0_30px_rgba(0,174,239,0.7)]"
                  >
                    {secondaryCtaText}
                  </button>
                ) : secondaryCtaHref && (
                  <Link
                    href={secondaryCtaHref}
                    className="border-2 border-blue-300 text-blue-100 hover:bg-blue-500 hover:text-white hover:border-blue-500 px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-[0_0_20px_rgba(0,174,239,0.4)] hover:shadow-[0_0_30px_rgba(0,174,239,0.7)]"
                  >
                    {secondaryCtaText}
                  </Link>
                )
              )}
              {tertiaryCtaText && tertiaryCtaOnClick && (
                <button
                  onClick={tertiaryCtaOnClick}
                  className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-4 rounded-full font-semibold text-lg transition-all shadow-[0_0_20px_rgba(251,191,36,0.6)] hover:shadow-[0_0_30px_rgba(251,191,36,0.8)]"
                >
                  <Music className="w-5 h-5" />
                  {tertiaryCtaText}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scroll Indicator */}
      {size === 'full' && (
        <div className="absolute bottom-32 right-8 animate-bounce">
          <div className="w-6 h-10 border-2 border-blue-300/50 rounded-full flex items-start justify-center p-2 shadow-[0_0_15px_rgba(0,174,239,0.4)]">
            <div className="w-1 h-2 bg-blue-300/70 rounded-full" />
          </div>
        </div>
      )}
    </section>
  );
}
