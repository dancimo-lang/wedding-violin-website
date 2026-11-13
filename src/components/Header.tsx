'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Instagram, Youtube, Facebook, Map } from 'lucide-react';
import navigation from '@/data/navigation.json';
import site from '@/data/site.json';
import { publishedGoogleHref } from '@/lib/publicContent';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const pathname = usePathname();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleServicesMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setServicesOpen(true);
  };

  const handleServicesMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setServicesOpen(false);
    }, 150); // 150ms delay before closing
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const googleHref = publishedGoogleHref(site.social.google);

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[var(--header-height)] bg-cream-card/95 backdrop-blur-md border-b border-cream-line">
      <nav className="container mx-auto px-6 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Logo */}
          <Link href="/" className="flex items-center p-1">
            <span 
              className="text-3xl text-ink"
              style={{ fontFamily: "'MonteCarlo', cursive" }}
            >
              Daniel Cimo
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navigation.mainNav.map((item) => (
              <div key={item.href} className="relative group">
                {item.children ? (
                  <>
                    <Link
                      href={item.href}
                      className={`transition-colors font-medium ${
                        isActive(item.href) 
                          ? 'text-gold-deep' 
                          : 'text-ink-body hover:text-ink'
                      }`}
                      onMouseEnter={handleServicesMouseEnter}
                      onMouseLeave={handleServicesMouseLeave}
                    >
                      {item.label}
                    </Link>
                    <div
                      className={`absolute top-full left-0 pt-2 ${servicesOpen ? 'block' : 'hidden'}`}
                      onMouseEnter={handleServicesMouseEnter}
                      onMouseLeave={handleServicesMouseLeave}
                    >
                      <div className="bg-cream-card/95 backdrop-blur-md rounded-2xl shadow-lg border border-cream-line py-2 min-w-[220px]">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`block px-4 py-2 transition-colors rounded-lg mx-1 ${
                              isActive(child.href)
                                ? 'bg-cream text-gold-deep'
                                : 'text-ink-soft hover:bg-cream hover:text-ink'
                            }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`transition-colors font-medium ${
                      isActive(item.href) 
                        ? 'text-gold-deep' 
                        : 'text-ink-body hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Right Side */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Social Icons */}
            <div className="flex items-center gap-3">
              <a
                href={site.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft hover:text-gold-deep transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={20} />
              </a>
              <a
                href={site.social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft hover:text-gold-deep transition-colors"
                aria-label="YouTube"
              >
                <Youtube size={20} />
              </a>
              <a
                href={site.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft hover:text-gold-deep transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={20} />
              </a>
              {googleHref && (
                <a
                  href={googleHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-soft hover:text-gold-deep transition-colors"
                  aria-label="Google Business Profile"
                >
                  <Map size={20} />
                </a>
              )}
            </div>

            {/* Book Now Button */}
            <Link
              href="/booking#booking-form"
              className="bg-gold hover:bg-gold-hover text-charcoal px-6 py-2.5 rounded-full font-medium transition-colors"
            >
              Book Now
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-3">
            <Link
              href="/booking#booking-form"
              className="bg-gold hover:bg-gold-hover text-charcoal px-4 py-2 rounded-full text-sm font-medium transition-colors"
            >
              Book Now
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-ink"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden absolute left-0 right-0 top-full bg-cream-card border-b border-cream-line shadow-lg px-6 pb-4 pt-4">
            <div className="flex flex-col gap-2">
              {navigation.mainNav.map((item) => (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block py-2 font-medium transition-colors ${
                      isActive(item.href)
                        ? 'text-gold-deep'
                        : 'text-ink-body hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <div className="pl-4">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`block py-2 transition-colors ${
                            isActive(child.href)
                              ? 'text-gold-deep'
                              : 'text-ink-soft hover:text-ink'
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile Social Icons */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-cream-line">
              <a
                href={site.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft hover:text-gold-deep transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={24} />
              </a>
              <a
                href={site.social.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft hover:text-gold-deep transition-colors"
                aria-label="YouTube"
              >
                <Youtube size={24} />
              </a>
              <a
                href={site.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-soft hover:text-gold-deep transition-colors"
                aria-label="Facebook"
              >
                <Facebook size={24} />
              </a>
              {googleHref && (
                <a
                  href={googleHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-soft hover:text-gold-deep transition-colors"
                  aria-label="Google Business Profile"
                >
                  <Map size={24} />
                </a>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
