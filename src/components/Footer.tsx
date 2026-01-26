import Link from 'next/link';
import { Instagram, Youtube, Facebook, Mail, MapPin } from 'lucide-react';
import site from '@/data/site.json';
import navigation from '@/data/navigation.json';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-br from-blue-950 to-blue-900 text-blue-200 border-t border-blue-500/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-blue-50 text-xl font-semibold mb-2 drop-shadow-[0_0_15px_rgba(0,174,239,0.4)]">{site.name}</h3>
            <p className="text-blue-300 text-sm mb-4 drop-shadow-[0_0_10px_rgba(0,174,239,0.3)]">{site.tagline}</p>
            <p className="text-sm text-blue-300/80">{site.description}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-blue-50 font-semibold mb-4 drop-shadow-[0_0_10px_rgba(0,174,239,0.3)]">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/services/weddings" className="hover:text-blue-300 transition-all hover:drop-shadow-[0_0_8px_rgba(0,174,239,0.5)]">
                  Wedding Services
                </Link>
              </li>
              <li>
                <Link href="/services/lessons" className="hover:text-blue-300 transition-all hover:drop-shadow-[0_0_8px_rgba(0,174,239,0.5)]">
                  Private Lessons
                </Link>
              </li>
              <li>
                <Link href="/services/recording" className="hover:text-blue-300 transition-all hover:drop-shadow-[0_0_8px_rgba(0,174,239,0.5)]">
                  Studio Recording
                </Link>
              </li>
              <li>
                <Link href="/music" className="hover:text-blue-300 transition-all hover:drop-shadow-[0_0_8px_rgba(0,174,239,0.5)]">
                  Music & Video
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-blue-300 transition-all hover:drop-shadow-[0_0_8px_rgba(0,174,239,0.5)]">
                  About Daniel
                </Link>
              </li>
            </ul>
          </div>

          {/* Service Areas */}
          <div>
            <h4 className="text-blue-50 font-semibold mb-4 drop-shadow-[0_0_10px_rgba(0,174,239,0.3)]">Service Areas</h4>
            <div className="flex items-start gap-2 text-sm">
              <MapPin size={16} className="mt-1 flex-shrink-0 text-blue-400 drop-shadow-[0_0_10px_rgba(0,174,239,0.5)]" />
              <ul className="space-y-1">
                {site.location.serviceAreas.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Contact & Social */}
          <div>
            <h4 className="text-blue-50 font-semibold mb-4 drop-shadow-[0_0_10px_rgba(0,174,239,0.3)]">Get in Touch</h4>
            <div className="space-y-3">
              <a
                href={`mailto:${site.email}`}
                className="flex items-center gap-2 hover:text-blue-300 transition-all hover:drop-shadow-[0_0_10px_rgba(0,174,239,0.5)]"
              >
                <Mail size={16} />
                <span className="text-sm">{site.email}</span>
              </a>

              <div className="flex items-center gap-4 pt-2">
                <a
                  href={site.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-300 transition-all hover:drop-shadow-[0_0_15px_rgba(0,174,239,0.7)]"
                  aria-label="Instagram"
                >
                  <Instagram size={24} />
                </a>
                <a
                  href={site.social.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-300 transition-all hover:drop-shadow-[0_0_15px_rgba(0,174,239,0.7)]"
                  aria-label="YouTube"
                >
                  <Youtube size={24} />
                </a>
                <a
                  href={site.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-300 transition-all hover:drop-shadow-[0_0_15px_rgba(0,174,239,0.7)]"
                  aria-label="Facebook"
                >
                  <Facebook size={24} />
                </a>
              </div>

              <Link
                href="/booking"
                className="inline-block mt-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white px-6 py-2.5 rounded-full font-medium transition-all shadow-[0_0_20px_rgba(0,174,239,0.5)] hover:shadow-[0_0_30px_rgba(0,174,239,0.7)]"
              >
                Book Now
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-blue-500/30 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-blue-300/60">
            © {currentYear} {site.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm">
            {navigation.footerNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-blue-300/60 hover:text-blue-300 transition-all hover:drop-shadow-[0_0_8px_rgba(0,174,239,0.5)]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
