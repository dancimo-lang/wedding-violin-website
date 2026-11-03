import type { Metadata } from "next";
import { Dancing_Script, Inter, MonteCarlo, Playfair_Display } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { JsonLd, generatePersonSchema, generateLocalBusinessSchema } from "@/components/SEO";
import { createPageMetadata } from "@/lib/page-metadata";
import { serifHeadings } from "@/lib/fonts";
import site from "@/data/site.json";

const homeTitle = `${site.name} - ${site.tagline}`;
const homeDescription =
  "Elegant live violin music for weddings, private lessons for all ages, and studio recording. Based in San Luis Obispo, serving Paso Robles and the Central Coast.";

const pageMetadata = createPageMetadata({
  title: homeTitle,
  absoluteTitle: true,
  description: homeDescription,
  path: "/",
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const monteCarlo = MonteCarlo({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-monte-carlo",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-playfair",
});

const dancingScript = Dancing_Script({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-signature",
});

export const metadata: Metadata = {
  ...pageMetadata,
  title: {
    default: homeTitle,
    template: `%s | ${site.name}`,
  },
  keywords: site.seo.keywords,
  authors: [{ name: site.name }],
  creator: site.name,
  metadataBase: new URL("https://danielcimo.com"),
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    ...pageMetadata.verification,
    google: "A_1SkiMWh4hDq4ZK4xaPCClZm-vvNEUgom8jmplkrbY",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <JsonLd data={[generatePersonSchema(), generateLocalBusinessSchema()]} />
      </head>
      <body className={`${inter.className} ${monteCarlo.variable} ${dancingScript.variable} ${playfair.variable} ${serifHeadings} antialiased bg-charcoal text-cream-bright`}>
        <Header />
        <main className="pt-[var(--header-height)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
