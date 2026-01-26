# Daniel Cimo - Professional Violinist

A production-ready Next.js marketing website for Daniel Cimo, a professional violinist serving San Luis Obispo, Paso Robles, and the Central Coast of California.

## 🎻 Overview

This website is designed to:
- Book wedding violin performances
- Sell private violin lessons
- Promote studio/session violin recording services

### Target SEO Keywords
- "Central Coast Wedding Violinist"
- "San Luis Obispo Violinist"
- "Paso Robles Wedding Violinist"

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **YouTube Integration:** @codesweetly/react-youtube-playlist
- **Deployment:** Vercel-ready

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── about/             # About page
│   ├── api/contact/       # Contact form API endpoint
│   ├── booking/           # Booking form page
│   ├── music/             # Music & Video page
│   ├── privacy/           # Privacy policy
│   ├── services/          # Services pages
│   │   ├── lessons/       # Private lessons
│   │   ├── recording/     # Studio recording
│   │   └── weddings/      # Wedding services (critical page)
│   └── terms/             # Terms of service
├── components/            # Reusable React components
│   ├── CTASection.tsx
│   ├── Footer.tsx
│   ├── Header.tsx
│   ├── Hero.tsx
│   ├── PackageCard.tsx
│   ├── SEO.tsx
│   ├── ServiceCard.tsx
│   ├── TestimonialCard.tsx
│   └── YouTubePlaylist.tsx
└── data/                  # JSON data files (content source)
    ├── about.json
    ├── lessons.json
    ├── music.json
    ├── navigation.json
    ├── recording.json
    ├── services.json
    ├── site.json
    ├── testimonials.json
    └── weddings.json
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18.17 or later
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd daniel-cimo-violin

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

### Environment Variables

Create a `.env.local` file for environment variables:

```env
# YouTube API Key (required for playlist component)
NEXT_PUBLIC_YOUTUBE_API_KEY=your_youtube_api_key

# Email service (choose one and configure)
# For Resend:
RESEND_API_KEY=your_resend_api_key

# For SendGrid:
SENDGRID_API_KEY=your_sendgrid_api_key
```

## 📝 Content Management

All page content is stored in JSON files under `/src/data/`. To update content:

1. **Site Info:** Edit `site.json` for name, contact, social links, SEO keywords
2. **Services:** Edit `services.json` for service cards on homepage
3. **Weddings:** Edit `weddings.json` for packages, pricing, logistics
4. **Lessons:** Edit `lessons.json` for lesson packages and philosophy
5. **Recording:** Edit `recording.json` for studio services
6. **Testimonials:** Edit `testimonials.json` for client reviews
7. **About:** Edit `about.json` for biography and credentials

### TODO Items to Complete

Search for `TODO:` in the codebase to find items that need attention:

- [ ] Add actual pricing to wedding packages (`weddings.json`)
- [ ] Add actual pricing to lesson packages (`lessons.json`)
- [ ] Add YouTube playlist ID (`music.json`)
- [ ] Add real testimonials (`testimonials.json`)
- [ ] Add biography details (`about.json`)
- [ ] Add credentials and education (`about.json`)
- [ ] Configure email sending in `/api/contact/route.ts`
- [ ] Add hero video file (`/public/videos/hero-video.mp4`)
- [ ] Add hero poster image (`/public/images/hero-poster.jpg`)
- [ ] Add professional photos
- [ ] Complete privacy policy and terms of service
- [ ] Update travel radius/service area details

## 🖼 Media Assets Required

Place these files in the `/public` directory:

```
public/
├── images/
│   ├── hero-poster.jpg      # Hero section fallback image
│   ├── about-hero.jpg       # About page hero
│   ├── services-hero.jpg    # Services page hero
│   ├── weddings-hero.jpg    # Weddings page hero
│   ├── lessons-hero.jpg     # Lessons page hero
│   ├── recording-hero.jpg   # Recording page hero
│   ├── music-hero.jpg       # Music page hero
│   └── og-default.jpg       # Open Graph default image (1200x630)
└── videos/
    └── hero-video.mp4       # Hero background video (optional)
```

## 🔍 SEO Features

- Page-specific meta titles and descriptions
- JSON-LD structured data (Person, LocalBusiness, Service schemas)
- Open Graph and Twitter Card meta tags
- Local SEO optimization for Central Coast service areas
- Semantic HTML structure
- Mobile-first responsive design

## 📧 Contact Form Setup

The contact form API (`/api/contact/route.ts`) includes a template for email integration. Choose an email service:

### Option 1: Resend (Recommended)
```bash
npm install resend
```

### Option 2: SendGrid
```bash
npm install @sendgrid/mail
```

### Option 3: Nodemailer (SMTP)
```bash
npm install nodemailer
```

See the comments in `/src/app/api/contact/route.ts` for implementation examples.

## 🚢 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

```bash
# Or deploy via CLI
npm i -g vercel
vercel
```

### Build for Production

```bash
npm run build
npm start
```

## 📱 Mobile Optimization

- Mobile-first Tailwind CSS styles
- Sticky header with prominent "Book Now" CTA
- Touch-friendly navigation
- Optimized for Core Web Vitals (LCP, CLS, FID)

## ♿ Accessibility

- WCAG AA compliant color contrast
- Semantic HTML structure
- Focus visible states
- Reduced motion support
- Screen reader friendly

## 📄 License

Private - All rights reserved.

## 👤 Contact

For questions about this website, contact the developer or reach out to Daniel Cimo at contact@danielcimo.com.
