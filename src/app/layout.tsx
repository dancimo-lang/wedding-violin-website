import type { Metadata } from "next";
import { Inter, MonteCarlo } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { JsonLd, generatePersonSchema, generateLocalBusinessSchema } from "@/components/SEO";
import site from "@/data/site.json";

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

export const metadata: Metadata = {
  title: {
    default: `${site.name} - ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  keywords: site.seo.keywords,
  authors: [{ name: site.name }],
  creator: site.name,
  metadataBase: new URL("https://danielcimo.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: site.name,
  },
  robots: {
    index: true,
    follow: true,
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
      <body className={`${inter.className} ${monteCarlo.variable} antialiased bg-white text-gray-900`}>
        <Header />
        <main className="pt-[64px]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
