import Link from 'next/link';
import Image from 'next/image';
import { Music } from 'lucide-react';
import { btnGold, btnOutlineOnDark } from '@/lib/theme';

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
  /** Kept so existing pages can opt into the shared gold buttons. */
  ctaTone?: 'blue' | 'gold';
  videoSrc?: string;
  posterSrc?: string;
  posterAlt?: string;
  backgroundPosition?: string;
  /** Responsive object-position classes. Overrides backgroundPosition when set. */
  imageClassName?: string;
  /** Replaces the default dark gradient over the photo. */
  overlayClassName?: string;
  /** Left keeps the headline over one side of a wide photo. Mobile stays centered. */
  contentAlign?: 'center' | 'left';
  overlay?: boolean;
  size?: 'full' | 'large' | 'medium';
  splitLayout?: boolean;
  leftSideImage?: string;
  rightSideImage?: string | null;
  rightSideImageAlt?: string;
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
  posterAlt,
  backgroundPosition = 'center',
  imageClassName,
  overlayClassName,
  contentAlign = 'center',
  overlay = true,
  size = 'large',
  splitLayout = false,
  rightSideImage,
  rightSideImageAlt,
}: HeroProps) {
  const sizeClasses = {
    full: 'lg:h-[calc(100svh-var(--header-height))] lg:min-h-[36rem]',
    large: 'min-h-[80vh]',
    medium: 'min-h-[60vh]',
  };

  const primaryCtaClass = btnGold;
  const secondaryCtaClass = btnOutlineOnDark;
  const tertiaryCtaClass = `gap-2 ${btnOutlineOnDark}`;

  const actions = (
    <div className={`flex flex-col sm:flex-row items-center gap-4 ${contentAlign === 'left' ? 'justify-center md:justify-start' : 'justify-center'}`}>
      {ctaText && (
        ctaOnClick ? (
          <button onClick={ctaOnClick} className={primaryCtaClass}>
            {ctaText}
          </button>
        ) : (
          <Link href={ctaHref} className={primaryCtaClass}>
            {ctaText}
          </Link>
        )
      )}
      {secondaryCtaText && (
        secondaryCtaOnClick ? (
          <button onClick={secondaryCtaOnClick} className={secondaryCtaClass}>
            {secondaryCtaText}
          </button>
        ) : secondaryCtaHref && (
          <Link href={secondaryCtaHref} className={secondaryCtaClass}>
            {secondaryCtaText}
          </Link>
        )
      )}
      {tertiaryCtaText && tertiaryCtaOnClick && (
        <button onClick={tertiaryCtaOnClick} className={tertiaryCtaClass}>
          <Music className="w-5 h-5" />
          {tertiaryCtaText}
        </button>
      )}
    </div>
  );

  return (
    <section className={`relative flex overflow-hidden bg-charcoal ${sizeClasses[size]} ${splitLayout ? '' : 'items-center justify-center'}`}>
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

      {!videoSrc && !splitLayout && (
        <div className="absolute inset-0">
          <Image
            src={posterSrc || '/images/hero-poster.jpg'}
            alt={
              posterAlt ??
              (posterSrc
                ? 'Hero background'
                : 'Daniel playing violin in a dark suit against a plain backdrop')
            }
            fill
            sizes="100vw"
            className={`object-cover ${imageClassName ?? ''}`}
            style={imageClassName ? undefined : { objectPosition: backgroundPosition }}
            priority
          />
        </div>
      )}

      {overlay && (
        <div className={`absolute inset-0 ${overlayClassName ?? 'bg-gradient-to-b from-black/40 via-black/20 to-black/50'}`} />
      )}

      {splitLayout ? (
        <div className="relative z-10 container mx-auto px-4 lg:h-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:h-full">
            <div className="flex flex-col justify-center lg:justify-start items-center text-center text-cream-bright px-6 py-16 lg:px-12 lg:pt-28 lg:pb-16">
              {subtitle && (
                <p className="text-gold-bright font-medium tracking-wide uppercase mb-6 text-sm md:text-base">
                  {subtitle}
                </p>
              )}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-8 leading-tight">
                {title}
              </h1>
              {description && (
                <p className="text-lg md:text-xl text-cream-muted mb-8 max-w-2xl">
                  {description}
                </p>
              )}
              {actions}
            </div>

            <div className="relative min-h-[52vh] lg:min-h-0">
              {rightSideImage && (
                <Image
                  src={rightSideImage}
                  alt={rightSideImageAlt ?? 'Daniel playing violin'}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                  priority
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={`relative z-10 container mx-auto px-4 text-center ${contentAlign === 'left' ? 'md:text-left' : ''} ${size === 'medium' ? 'mt-[20vh]' : size === 'large' ? (contentAlign === 'left' ? 'md:-mt-[10vh]' : '-mt-[20vh]') : ''}`}>
          <div className={`max-w-4xl ${contentAlign === 'left' ? 'mx-auto md:mx-0 md:max-w-lg' : 'mx-auto'}`}>
            {subtitle && (
              <p className="text-white/90 font-medium tracking-wide uppercase mb-4 text-sm md:text-base drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {subtitle}
              </p>
            )}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-white mb-6 leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
              {title}
            </h1>
            {description && (
              <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] backdrop-blur-sm bg-black/30 px-6 py-3 rounded-2xl">
                {description}
              </p>
            )}
            {actions}
          </div>
        </div>
      )}

      {size === 'full' && (
        <div className="absolute bottom-8 right-8 animate-bounce">
          <div className="w-6 h-10 border-2 border-gold/70 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-gold rounded-full" />
          </div>
        </div>
      )}
    </section>
  );
}
